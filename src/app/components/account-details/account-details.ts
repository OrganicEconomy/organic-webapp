import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-account-details',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatListModule,
    QRCodeComponent
  ],
  templateUrl: './account-details.html',
  styleUrl: './account-details.css',
})
export class AccountDetails {
  userService = inject(ConnectedUserService)

  user: any
  name: string = ""
  inscription_date: string = ""
  publickey: string = ""


  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }

    this.name = this.user.name
    this.publickey = this.user.publickey
  }
}
