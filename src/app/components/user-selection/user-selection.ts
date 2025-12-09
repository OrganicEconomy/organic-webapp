import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LocalDatabaseService } from '../../services/local-database.service'
import { ConnectedUserService } from '../../services/connected-user.service'

@Component({
  selector: 'app-user-selection',
  imports: [
    RouterLink
  ],
  templateUrl: './user-selection.html',
  styleUrl: './user-selection.css',
})
export class UserSelection {
  localDB = inject(LocalDatabaseService)
  userService = inject(ConnectedUserService)
  users: any[] = []

  constructor (private router: Router) {}

  async ngOnInit() {
    this.users = await this.localDB.getUserList()
  }

  selectUser(index: number) {
    this.userService.setConnectedUser(this.users[index])
    this.router.navigate(['/home']);
  }
}
