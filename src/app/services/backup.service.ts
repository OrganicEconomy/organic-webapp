import { Injectable, inject } from '@angular/core';
import { catchError, concatMap, defer, from, last, map, Observable, tap, throwError } from 'rxjs';
import { LocalDatabaseService } from './local-database.service';
import { ServerConnexionService } from './server-connection.service';
import { ConnectedUserService } from './connected-user.service';
import type { LoadedAccount, PendingOfflineTx } from '../models/account';
import type { TxWire } from 'organic-protocol';
import { CitizenBlockchain } from 'organic-money/src/index.js';

export class UndoNotStoredError extends Error {}

const UNDO_NOT_STORED_MESSAGE =
  "Opération refusée par le serveur, mais cet appareil n'a pas pu enregistrer son annulation : déconnectez-vous, puis reconnectez-vous pour reprendre la copie du serveur."

interface AccountSnapshot {
  chain: unknown
  sentOfflineTx: TxWire[]
  pendingOfflineTx: PendingOfflineTx[]
}

function snapshotOf(user: LoadedAccount): AccountSnapshot {
  return {
    chain: user.blockchain.export(),
    sentOfflineTx: user.sentOfflineTx?.slice(),
    pendingOfflineTx: user.pendingOfflineTx?.slice(),
  }
}

function restore(user: LoadedAccount, before: AccountSnapshot): void {
  user.blockchain = new CitizenBlockchain(before.chain)
  user.sentOfflineTx = before.sentOfflineTx
  user.pendingOfflineTx = before.pendingOfflineTx
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private localDB = inject(LocalDatabaseService)
  private serverDB = inject(ServerConnexionService)
  private userService = inject(ConnectedUserService)

  /**
   * After an automatic mutation (daily money, receiving a payment, cashing a
   * paper…): always saved locally, pushed to the server only if the account's
   * policy allows it.
   */
  private pushToServerIfThePolicyAsks(user: LoadedAccount, sk: string): void {
    if (user.backupPolicy === 'every-tx') {
      this.pushToServer(user, sk).subscribe()
    }
  }

  recordAutomatic(user: LoadedAccount, sk: string): void {
    if (this.userService.isReadOnlySession()) {
      return
    }
    this.localDB.saveUserInBackground(user)
    this.pushToServerIfThePolicyAsks(user, sk)
  }

  private applyOrUndo<T>(user: LoadedAccount, before: AccountSnapshot, change: () => T): T {
    try {
      return change()
    } catch (err) {
      restore(user, before)
      throw err
    }
  }

  async applyAndRecord<T>(user: LoadedAccount, sk: string, change: () => T): Promise<T> {
    const before = snapshotOf(user)
    const result = this.applyOrUndo(user, before, change)
    try {
      await this.localDB.saveUser(user)
    } catch (error) {
      restore(user, before)
      throw error
    }
    this.pushToServerIfThePolicyAsks(user, sk)
    return result
  }

  private storeOnDeviceOrUndo(user: LoadedAccount, before: AccountSnapshot): Observable<unknown> {
    return from(this.localDB.saveUser(user)).pipe(
      tap({ error: () => restore(user, before) }),
    )
  }

  private async undoOnDevice(user: LoadedAccount, before: AccountSnapshot): Promise<void> {
    restore(user, before)
    try {
      await this.localDB.saveUser(user)
    } catch (error) {
      throw new UndoNotStoredError(UNDO_NOT_STORED_MESSAGE, { cause: error })
    }
  }

  private pushToServerOrUndo(user: LoadedAccount, sk: string, before: AccountSnapshot): Observable<unknown> {
    return this.pushToServer(user, sk).pipe(
      catchError((serverError) => from(this.undoOnDevice(user, before)).pipe(
        concatMap(() => throwError(() => serverError)),
      )),
    )
  }

  applyAndSave<T>(user: LoadedAccount, sk: string, change: () => T): Observable<T> {
    return defer(() => {
      const before = snapshotOf(user)
      const result = this.applyOrUndo(user, before, change)
      return this.storeOnDeviceOrUndo(user, before).pipe(
        concatMap(() => this.pushToServerOrUndo(user, sk, before)),
        map(() => result),
      )
    })
  }


  /** "Sauvegarder maintenant" button (manual policy). */
  saveNow(user: LoadedAccount, sk: string): Observable<unknown> {
    return this.pushToServer(user, sk)
  }

  /**
   * Blocks closed locally since the last confirmed save (e.g. several paper
   * bills generated offline back to back, closing more than one block before
   * a save ever got a chance to run) must all reach the server, oldest
   * first — sending only the current one would leave a gap in the server's
   * copy of the chain, discovered only much later as an opaque failure.
   * Returns the backlog oldest-first, always including at least the current
   * block (`blocks[0]`) even when nothing needs catching up.
   */
  private blocksNeedingSync(user: LoadedAccount): any[] {
    const blocks = user.blockchain.blocks
    const idx = blocks.findIndex((b: any) => b.signature === user.lastSavedBlockSignature)
    const backlog = idx <= 0 ? [blocks[0]] : blocks.slice(0, idx)
    return backlog.slice().reverse()
  }

  // A single, un-subscribed-to-twice pipe: side effects ride along via tap()
  // rather than an internal subscribe(), so callers that subscribe to the
  // returned Observable (pay.ts, "Sauvegarder maintenant") trigger exactly
  // one round of HTTP requests, not two. Blocks are sent one PUT at a time,
  // in order (concatMap) — sending two at once would race on the server's
  // "does this chain onto what I have" check.
  private pushToServer(user: LoadedAccount, sk: string): Observable<unknown> {
    const blocks = this.blocksNeedingSync(user)
    return from(blocks).pipe(
      concatMap((block) => this.serverDB.saveBlock(user, sk, block).pipe(
        tap(() => {
          if (block.isSigned()) user.lastSavedBlockSignature = block.signature
        })
      )),
      last(),
      tap({
        next: () => {
          user.lastBackupAt = new Date().toISOString()
          user.isuptodate = true
          this.localDB.saveUserInBackground(user)
        },
        error: (err: any) => {
          if (err.status === 409) {
            this.userService.setReadOnly()
          }
        },
      })
    )
  }
}
