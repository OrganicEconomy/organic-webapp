import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';

@Component({
  selector: 'app-contacts',
  imports: [
    RouterLink,
    MatTableModule,
    MatButtonModule
  ],
  templateUrl: './contacts.html',
  styleUrl: './contacts.css',
})
export class Contacts {
  userService = inject(ConnectedUserService)
  user = this.userService.getConnectedUser()

  constructor(private router: Router) {
    if (this.user === null) {
      this.router.navigate(['/user-selection']);
      return
    }
  }

  displayedColumns: string[] = ['name', 'pk']
  dataSource = this.user.contacts
}
