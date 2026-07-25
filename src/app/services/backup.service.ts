import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
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

  // A single, un-subscribed-to-twice pipe: side effects ride along via tap()
  // rather than an internal subscribe(), so callers that subscribe to the
  // returned Observable (pay.ts, "Sauvegarder maintenant") trigger exactly
  // one HTTP request, not two.
  private pushToServer(user: LoadedAccount, sk: string): Observable<unknown> {
    return this.serverDB.saveLastBlock(user, sk).pipe(
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
