import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatBadgeModule } from '@angular/material/badge';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressBarModule,
    MatCardModule,
    MatDividerModule,
    MatListModule,
    MatBadgeModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)
  serverDB = inject(ServerConnexionService)
  private snackBar = inject(MatSnackBar)

  user: any
  solde = 0
  level = 0
  percent = 0
  pendingCount = 0

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.createDailyMoney()
    this.update()
    this.loadPendingCount()
  }

  update() {
    this.solde = this.user.blockchain.getAvailableMoneyAmount()
    this.level = this.user.blockchain.getLevel()
    this.percent = this.user.blockchain.getMoneyBeforeNextLevel(true)
  }

  private createDailyMoney() {
    const sk = this.userService.getSecretKey()
    const result = this.user.blockchain.createMoneyAndInvests(sk)
    if (result) {
      this.localDB.saveUser(this.user)
      this.serverDB.saveLastBlock(this.user, sk)
      this.snackBar.open(`${result.money.length} unité(s) créée(s) aujourd'hui !`, 'OK', { duration: 3000 })
    }
  }

  private loadPendingCount() {
    const sk = this.userService.getSecretKey()
    this.serverDB.getTransactionList(this.user.serverUrl, this.user.publickey, sk).subscribe({
      next: (list) => { this.pendingCount = list.length },
      error: () => { /* offline or unreachable — badge just stays at 0 */ },
    })
  }

}
