import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import {MatListModule} from '@angular/material/list';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressBarModule,
    MatCardModule,
    MatDividerModule,
    MatListModule
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)

  user: any
  solde = 0
  level = 0
  percent = 0
  isDailyMoneyCreated = false
  password: any

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.update()
  }

  update() {
    this.solde = this.user.blockchain.getAvailableMoneyAmount()
    this.level = this.user.blockchain.getLevel()
    this.percent = this.user.blockchain.getMoneyBeforeNextLevel(true)
  }

  public createDailyMoney() {
    const result = this.user.blockchain.createMoneyAndInvests(this.user.secretkey)
    this.update()
    this.localDB.saveUser(this.user)
  }

}
