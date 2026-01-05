import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { CitizenBlockchain } from 'organic-money/src/index.js';
import { LocalDatabaseService } from '../../services/local-database.service';
import {MatButtonModule} from '@angular/material/button';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    MatButtonModule
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)

  blockchain: any
  user: any
  solde = 0
  level = 0
  percent = 0
  isDailyMoneyCreated = true
  password: any

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.blockchain = new CitizenBlockchain(this.user.blocks)
    this.update()
  }

  update() {
    this.solde = this.blockchain.getAvailableMoneyAmount()
    this.level = this.blockchain.getLevel()
    this.percent = this.blockchain.getMoneyBeforeNextLevel(true)
  }

  public createDailyMoney() {
    const result = this.blockchain.createMoneyAndInvests(this.user.secretkey)
    this.update()
    this.localDB.saveUser(this.user)
  }

}
