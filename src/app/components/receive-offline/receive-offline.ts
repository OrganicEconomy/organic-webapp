import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { decodeQr } from 'organic-protocol';
import type { TxVerifyStatus } from 'organic-protocol';
import { TransactionMaker } from 'organic-money/src/index.js';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { BackupService } from '../../services/backup.service';
import { getContactName } from '../../utils/transaction-display.util';

@Component({
  selector: 'app-receive-offline',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    ZXingScannerModule,
  ],
  templateUrl: './receive-offline.html',
  styleUrl: './receive-offline.css',
})
export class ReceiveOffline {
  userService = inject(ConnectedUserService)
  serverDB = inject(ServerConnexionService)
  backupService = inject(BackupService)
  private _snackBar = inject(MatSnackBar)

  user: any
  scanError = ''
  /** In-memory only (Phase 1 scope) — not persisted on the account. */
  private statuses = new Map<string, TxVerifyStatus>()

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.verifyAll()
  }

  get displayRows() {
    return this.user.pendingOfflineTx.map((entry: any) => {
      const tx = TransactionMaker.make(entry.tx)
      return {
        hash: tx.signature,
        date: tx.date.toLocaleDateString('fr-FR'),
        amount: tx.money.length,
        source: getContactName(tx.signer, this.user.blockchain.getMyPublicKey(), this.user.contacts),
        status: this.statuses.get(tx.signature) ?? 'pending',
        entry,
      }
    })
  }

  scanSuccessHandler(result: string) {
    this.scanError = ''
    let decoded
    try {
      decoded = decodeQr(result)
    } catch {
      this.scanError = "Ce QR n'est pas reconnu."
      return
    }
    if (decoded.type !== 'TX') {
      this.scanError = "Ce QR n'est pas un paiement hors-ligne."
      return
    }
    if (this.userService.isReadOnlySession()) {
      this.scanError = "Ce compte est actif sur un autre appareil — lecture seule."
      return
    }

    let tx: any
    try {
      tx = TransactionMaker.make(decoded.payload.tx)
      this.user.blockchain.receivePay(tx)
    } catch {
      this.scanError = "Ce paiement n'est pas valide (signature ou destinataire incorrect)."
      return
    }

    const sk = this.userService.getSecretKey()
    this.user.pendingOfflineTx.push({ tx: decoded.payload.tx, url: decoded.payload.url })
    this.backupService.recordAutomatic(this.user, sk)
    this._snackBar.open(`${tx.money.length} unité(s) reçue(s) — en attente de vérification.`, 'OK', { duration: 3000 })
  }

  verifyAll() {
    for (const entry of this.user.pendingOfflineTx) {
      const currentStatus = this.statuses.get(entry.tx.h)
      if (currentStatus === 'invalid' || currentStatus === 'unknown-sender') continue

      this.serverDB.verifyTransaction(entry.url, entry.tx).subscribe({
        next: (res) => {
          if (res.status === 'confirmed') {
            this.removeFromPending(entry.tx.h)
          } else {
            this.statuses.set(entry.tx.h, res.status)
          }
        },
        error: () => { /* offline or unreachable — stays pending, retried next time */ },
      })
    }
  }

  dismiss(hash: string) {
    this.removeFromPending(hash)
  }

  private removeFromPending(hash: string) {
    this.user.pendingOfflineTx = this.user.pendingOfflineTx.filter((e: any) => e.tx.h !== hash)
    this.statuses.delete(hash)
    this.backupService.recordAutomatic(this.user, this.userService.getSecretKey())
  }
}
