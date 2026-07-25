import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { BackupService } from '../../services/backup.service';
import { encodeContactQr } from 'organic-protocol';
import type { InfoResponse } from 'organic-protocol';
import type { BackupPolicy } from '../../models/account';
import { encryptSecretKey, decryptSecretKey } from '../../services/secret-key-crypto.util';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-account-details',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatListModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    DatePipe,
    QRCodeComponent,
  ],
  templateUrl: './account-details.html',
  styleUrl: './account-details.css',
})
export class AccountDetails {
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)
  serverDB = inject(ServerConnexionService)
  backupService = inject(BackupService)
  private _snackBar = inject(MatSnackBar)

  user: any
  name: string = ""
  inscription_date: string = ""
  publickey: string = ""
  myContactQr: string = ""

  backupPolicy: BackupPolicy = 'every-tx'
  lastBackupAt: string | null = null

  serverInfo: InfoResponse | null = null

  oldPassword = ""
  newPassword = ""
  newPasswordConfirm = ""

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }

    this.name = this.user.name
    this.publickey = this.user.publickey
    this.myContactQr = encodeContactQr({ pk: this.user.publickey, url: this.user.serverUrl, n: this.user.name })
    const birthBlock = this.user.blockchain.blocks[this.user.blockchain.blocks.length - 1]
    this.inscription_date = birthBlock.closedate.toLocaleDateString('fr-FR')

    this.backupPolicy = this.user.backupPolicy
    this.lastBackupAt = this.user.lastBackupAt

    this.serverDB.getServerInfo(this.user.serverUrl).subscribe({
      next: (info) => { this.serverInfo = info },
      error: () => { /* offline or unreachable — server info panel just stays empty */ },
    })
  }

  updateBackupPolicy(policy: BackupPolicy): void {
    this.backupPolicy = policy
    this.user.backupPolicy = policy
    this.localDB.saveUser(this.user)
  }

  saveNow(): void {
    const sk = this.userService.getSecretKey()
    this.backupService.saveNow(this.user, sk).subscribe({
      next: () => {
        this.lastBackupAt = this.user.lastBackupAt
        this.displayMessage("Sauvegardé.")
      },
      error: (err: any) => {
        console.log(err)
        this.displayMessage("Échec de la sauvegarde — réessayez plus tard.")
      },
    })
  }

  async changePassword(): Promise<void> {
    if (this.newPassword !== this.newPasswordConfirm) {
      this.displayMessage("Les deux mots de passe ne correspondent pas.")
      return
    }

    let sk: string
    try {
      sk = await decryptSecretKey(this.user.secretkey, this.oldPassword)
    } catch {
      this.displayMessage("Ancien mot de passe incorrect.")
      return
    }

    const newEncrypted = await encryptSecretKey(sk, this.newPassword)
    this.serverDB.changePassword(this.user.serverUrl, this.user.publickey, this.newPassword, newEncrypted, sk).subscribe({
      next: () => {
        this.user.secretkey = newEncrypted
        this.localDB.saveUser(this.user)
        this.oldPassword = ""
        this.newPassword = ""
        this.newPasswordConfirm = ""
        this.displayMessage("Mot de passe changé avec succès.")
      },
      error: (err: any) => {
        console.log(err)
        this.displayMessage("Erreur lors du changement de mot de passe.")
      },
    })
  }

  displayMessage(message: string) {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }
}
