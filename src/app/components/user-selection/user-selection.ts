import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LocalDatabaseService } from '../../services/local-database.service'
import { ConnectedUserService } from '../../services/connected-user.service'
import { Dialog, DialogRef, DIALOG_DATA, DialogModule } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';

export interface DialogData {
  password: string;
}
@Component({
  selector: 'app-user-selection',
  imports: [
    RouterLink,
    DialogModule
  ],
  templateUrl: './user-selection.html',
  styleUrl: './user-selection.css',
})
export class UserSelection {
  localDB = inject(LocalDatabaseService)
  userService = inject(ConnectedUserService)
  dialog = inject(Dialog);
  users: any[] = []

  constructor(private router: Router) { }

  async ngOnInit() {
    this.users = await this.localDB.getUserList()
  }

  selectUser(index: number) {
    const dialogRef = this.dialog.open<string>(PasswordDialog, {
      width: '250px',
      data: {}
    });

    dialogRef.closed.subscribe(result => {
      if (this.passwordIsOk(this.users[index], result)) {
        this.userService.setConnectedUser(this.users[index])
        this.router.navigate(['/home']);
      }
    });
  }

  passwordIsOk(user: any, password: any): boolean {
    return user.password === password
  }
}

@Component({
  selector: 'password-dialog',
  templateUrl: 'password-dialog.html',
  styleUrl: 'password-dialog.css',
  imports: [
    FormsModule,
    MatFormFieldModule
  ],
})
export class PasswordDialog {
  dialogRef = inject<DialogRef<string>>(DialogRef<string>);
  data = inject(DIALOG_DATA);
}

