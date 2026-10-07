import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormField } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { QRCodeComponent } from 'angularx-qrcode';
import { encodeOfflineTxQr } from 'organic-protocol';
import { TransactionMaker } from 'organic-money/src/index.js';
import { ConnectedUserService } from '../../services/connected-user.service';
import { BackupService } from '../../services/backup.service';
import { getContactName } from '../../utils/transaction-display.util';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-pay-offline',
  imports: [
    FormsModule,
    RouterLink,
    MatFormField,
    MatSelectModule,
    MatSliderModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    QRCodeComponent,
  ],
  templateUrl: './pay-offline.html',
  styleUrl: './pay-offline.css',
})
export class PayOffline {
  userService = inject(ConnectedUserService)
  backupService = inject(BackupService)
  private _snackBar = inject(MatSnackBar)

  user: any
  contacts: any = []
  amount = 0
  max = 0
  target = ''

  currentQr: string | null = null

  private dialog = inject(MatDialog)

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.max = this.user.blockchain.getAvailableMoneyAmount()
    this.contacts = this.user.contacts
  }

  get recentlySent() {
    return this.user.sentOfflineTx.map((wireTx: any) => {
      const tx = TransactionMaker.make(wireTx)
      return { date: tx.date.toLocaleDateString('fr-FR'), amount: tx.money.length, wireTx }
    })
  }

  selectedValue(event: MatSelectChange) {
    this.target = event.value
  }

  payOffline(): void {
    if (!this.target) {
      this.displayMessage("Le champs 'À qui ?' est obligatoire.")
      return
    }
    if (this.amount <= 0) {
      this.displayMessage("Le montant à payer doit être supérieur à zéro.")
      return
    }
    if (this.userService.isReadOnlySession()) {
      this.displayMessage("Ce compte est actif sur un autre appareil — lecture seule.")
      return
    }

    const recipient = getContactName(this.target, this.user.blockchain.getMyPublicKey(), this.contacts)
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data: { title: 'Payer par QR', message: `Payer ${this.amount} à ${recipient} par QR ? Les unités seront immédiatement retirées de votre solde.` },
    });
    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.executePayOffline();
    });
  }

  private executePayOffline(): void {
    try {
      const sk = this.userService.getSecretKey()
      const tx = this.user.blockchain.pay(sk, this.target, this.amount)
      const wireTx = tx.export()

      this.user.sentOfflineTx.push(wireTx)
      this.backupService.recordAutomatic(this.user, sk)

      this.review(wireTx)
    } catch (err) {
      console.log(err)
      this.displayMessage("Une erreur est survenue oO")
    }
  }

  review(wireTx: any): void {
    this.currentQr = encodeOfflineTxQr({ tx: wireTx, url: this.user.serverUrl })
  }

  newPayment(): void {
    this.currentQr = null
    this.amount = 0
    this.target = ''
  }

  displayMessage(message: string) {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }
}
