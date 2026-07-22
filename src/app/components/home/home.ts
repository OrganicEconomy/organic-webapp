import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { toDisplayRow } from '../../utils/transaction-display.util';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressBarModule,
    MatCardModule,
    MatDividerModule,
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
  xp = 0
  remainingBeforeNextLevel = 0
  etaDays: number | null = null
  pendingCount = 0
  recentTransactions: any[] = []

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
    const bc = this.user.blockchain
    this.solde = bc.getAvailableMoneyAmount()
    this.level = bc.getLevel()
    this.percent = bc.getMoneyBeforeNextLevel(true)
    this.xp = bc.experience
    this.remainingBeforeNextLevel = bc.getMoneyBeforeNextLevel()
    // La création quotidienne mint `level` unité(s)/jour — approximation qui
    // ignore les paiements reçus entre-temps (qui accélèreraient l'ETA).
    this.etaDays = this.level > 0 ? Math.ceil(this.remainingBeforeNextLevel / this.level) : null
    this.recentTransactions = bc.getHistory().slice(0, 5)
      .map((tx: any) => toDisplayRow(tx, bc.getMyPublicKey(), this.user.contacts))
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
