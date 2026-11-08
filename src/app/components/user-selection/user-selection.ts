import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { decryptSecretKey } from '../../services/secret-key-crypto.util';

// Angular Material
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

export interface DialogData {
  password: string;
}

import type { Account } from '../../models/account';

const ACCOUNTS_NOT_READ_MESSAGE =
  "Cet appareil n'a pas pu lire ses comptes. Quittez la navigation privée, ou vérifiez que le site peut enregistrer des données.";

@Component({
  selector: 'app-user-selection',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatListModule,
  ],
  templateUrl: './user-selection.html',
  styleUrl: './user-selection.css',
})
export class UserSelection {
  localDB = inject(LocalDatabaseService);
  userService = inject(ConnectedUserService);
  dialog = inject(MatDialog);
  users: any[] = [];
  loadError = '';

  constructor(private router: Router, private route: ActivatedRoute) { }

  async ngOnInit() {
    try {
      this.users = await this.localDB.getUserList();
    } catch (error) {
      console.error(error);
      this.loadError = ACCOUNTS_NOT_READ_MESSAGE;
      return;
    }
    if (this.users.length === 0) {
      // First launch, or every local account was removed — start the entry
      // flow from the top (Phase-1.md §7 navigation card).
      this.router.navigate(['/server-selection']);
    }
  }

  private async accountAsStoredNow(publickey: string): Promise<Account | null> {
    try {
      const account = await this.localDB.getUser(publickey)
      if (account === null) {
        alert("Ce compte n'est plus sur cet appareil.")
      }
      return account
    } catch (error) {
      console.error(error)
      this.loadError = ACCOUNTS_NOT_READ_MESSAGE
      return null
    }
  }

  selectUser(index: number) {
    const dialogRef = this.dialog.open(PasswordDialog, {
      width: '320px',
      data: { password: '' }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === undefined) return
      const secretKey = await this.tryUnlock(this.users[index], result)
      if (secretKey === null) {
        alert("Mot de passe incorrect.")
        return
      }
      const account = await this.accountAsStoredNow(this.users[index].publickey)
      if (account === null) {
        return
      }
      this.userService.setConnectedUser(account, secretKey);
      if (account.status !== 'active') {
        this.router.navigate(['/pending-validation']);
      } else {
        this.openRequestedPageOrHome();
      }
    });
  }

  private openRequestedPageOrHome(): void {
    const requestedPage = this.route.snapshot.queryParamMap.get('next')
    if (requestedPage) {
      this.router.navigateByUrl(requestedPage);
    } else {
      this.router.navigate(['/home']);
    }
  }

  /**
   * Unlocking is decryption, never a password comparison: a wrong password
   * makes decryptSecretKey throw (Invalid password), which is the only
   * signal of failure.
   */
  async tryUnlock(user: any, password: string): Promise<string | null> {
    try {
      return await decryptSecretKey(user.secretkey, password)
    } catch {
      return null
    }
  }
}

@Component({
  selector: 'password-dialog',
  templateUrl: 'password-dialog.html',
  styleUrl: 'password-dialog.css',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
})
export class PasswordDialog {
  dialogRef = inject<MatDialogRef<PasswordDialog>>(MatDialogRef<PasswordDialog>);
  data = inject<DialogData>(MAT_DIALOG_DATA);
}
