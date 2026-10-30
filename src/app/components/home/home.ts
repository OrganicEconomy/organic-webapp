import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { requestedAgo } from '../../utils/requested-ago.util';
import { PendingPaymentsService } from '../../services/pending-payments.service';
import { BackupService } from '../../services/backup.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LevelUpService } from '../../services/level-up.service';
import { DailyMoneyDialog, DailyMoneyDialogData } from '../daily-money-dialog/daily-money-dialog';
import type { ValidationListEntry, MyEcosystemEntry } from 'organic-protocol';
import { TXTYPE } from 'organic-money/src/Transaction.js';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressBarModule,
    MatCardModule,
    MatIconModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  userService = inject(ConnectedUserService)
  pending = inject(PendingPaymentsService)
  backupService = inject(BackupService)
  private server = inject(ServerConnexionService)
  private dialog = inject(MatDialog)
  private levelUp = inject(LevelUpService)

  requestedAgo = requestedAgo;

  user: any
  solde = 0
  level = 0
  percent = 0
  xp = 0
  remainingBeforeNextLevel = 0
  pendingValidations: ValidationListEntry[] = []
  myEcosystems: MyEcosystemEntry[] = []

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.myEcosystems = this.user.myEcosystems ?? []

    if (!this.userService.isReadOnlySession()) {
      this.createDailyMoney()
    }
    this.update()
    this.pending.refresh()

    const sk = this.userService.getSecretKey()
    this.server.getValidationList(this.user.serverUrl, this.user.publickey, sk).subscribe({
      next: (list) => { this.pendingValidations = list },
      error: () => { this.pendingValidations = [] },
    })
  }

  cash(hash: string): void {
    this.pending.cash(hash)
    this.update()
  }

  update() {
    const bc = this.user.blockchain
    this.solde = bc.getAvailableMoneyAmount()
    this.level = bc.getLevel()
    this.percent = bc.getMoneyBeforeNextLevel(true)
    this.xp = bc.experience
    this.remainingBeforeNextLevel = bc.getMoneyBeforeNextLevel()
  }

  private createDailyMoney() {
    const sk = this.userService.getSecretKey()
    const oldLevel = this.user.blockchain.getLevel()
    const transactions = this.user.blockchain.createMoneyAndInvests(sk)
    if (transactions.length === 0) {
      return
    }
    this.backupService.recordAutomatic(this.user, sk)
    this.dialog.open(DailyMoneyDialog, { data: this.dailyMoneyData(transactions) })
      .afterClosed()
      .subscribe(() => this.levelUp.celebrateIfLevelUp(oldLevel, this.user.blockchain.getLevel()))
  }

  private dailyMoneyData(transactions: any[]): DailyMoneyDialogData {
    const cashing = transactions.find(tx => tx.type === TXTYPE.PAY)
    return {
      created: transactions[transactions.length - 1].money.length,
      cashed: cashing ? cashing.money.length : 0,
    }
  }

}
