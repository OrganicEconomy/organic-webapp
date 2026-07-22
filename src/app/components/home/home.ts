import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { toDisplayRow } from '../../utils/transaction-display.util';
import { PendingPaymentsService } from '../../services/pending-payments.service';
import { BackupService } from '../../services/backup.service';

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
  pending = inject(PendingPaymentsService)
  backupService = inject(BackupService)
  private snackBar = inject(MatSnackBar)

  user: any
  solde = 0
  level = 0
  percent = 0
  xp = 0
  remainingBeforeNextLevel = 0
  recentTransactions: any[] = []

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    if (!this.userService.isReadOnlySession()) {
      this.createDailyMoney()
    }
    this.update()
    this.pending.refresh()
  }

  update() {
    const bc = this.user.blockchain
    this.solde = bc.getAvailableMoneyAmount()
    this.level = bc.getLevel()
    this.percent = bc.getMoneyBeforeNextLevel(true)
    this.xp = bc.experience
    this.remainingBeforeNextLevel = bc.getMoneyBeforeNextLevel()
    this.recentTransactions = bc.getHistory().slice(0, 5)
      .map((tx: any) => toDisplayRow(tx, bc.getMyPublicKey(), this.user.contacts))
  }

  private createDailyMoney() {
    const sk = this.userService.getSecretKey()
    const result = this.user.blockchain.createMoneyAndInvests(sk)
    if (result) {
      this.backupService.recordAutomatic(this.user, sk)
      this.snackBar.open(`${result.money.length} unité(s) créée(s) aujourd'hui !`, 'OK', { duration: 3000 })
    }
  }

}
