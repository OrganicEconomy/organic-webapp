import { Injectable, inject } from '@angular/core';
import { concatMap, from, last, Observable, tap } from 'rxjs';
import { LocalDatabaseService } from './local-database.service';
import { ServerConnexionService } from './server-connection.service';
import { ConnectedUserService } from './connected-user.service';
import type { LoadedAccount } from '../models/account';

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
  recordAutomatic(user: LoadedAccount, sk: string): void {
    this.localDB.saveUser(user)
    if (user.backupPolicy === 'every-tx') {
      this.pushToServer(user, sk).subscribe()
    }
  }

  /**
   * Functional save before sending an online payment — happens regardless of
   * policy (Phase-1.md §4.2/§9.2), otherwise tx/send would reject it. Returns
   * the Observable so the caller only sends after this succeeds (strict
   * pay → save → send order).
   */
  recordPayment(user: LoadedAccount, sk: string): Observable<unknown> {
    this.localDB.saveUser(user)
    return this.pushToServer(user, sk)
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
          this.localDB.saveUser(user)
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
