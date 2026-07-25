import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormField } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { QRCodeComponent } from 'angularx-qrcode';
import { encodeOfflineTxQr } from 'organic-protocol';
import { TransactionMaker } from 'organic-money/src/index.js';
import { ConnectedUserService } from '../../services/connected-user.service';
import { BackupService } from '../../services/backup.service';

@Component({
  selector: 'app-pay-offline',
  imports: [
    FormsModule,
    RouterLink,
    MatFormField,
    MatSelectModule,
    MatSliderModule,
    MatButtonModule,
    MatInputModule,
    MatCardModule,
    MatDividerModule,
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
  validated = false

  currentQr: string | null = null

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
    if (!this.validated) {
      this.displayMessage("Veuillez cocher la case de confirmation.")
      return
    }
    if (this.userService.isReadOnlySession()) {
      this.displayMessage("Ce compte est actif sur un autre appareil — lecture seule.")
      return
    }
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
    this.validated = false
  }

  displayMessage(message: string) {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }
}
