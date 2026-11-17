import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';

@Component({
  selector: 'app-logout',
  imports: [],
  templateUrl: './logout.html',
  styleUrl: './logout.css',
})
export class Logout {
  constructor() {
    inject(ConnectedUserService).disconnect();
    inject(Router).navigate(['/user-selection']);
  }
}
