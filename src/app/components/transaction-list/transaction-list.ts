import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';
import { DisplayRow, toDisplayRow } from '../../utils/transaction-display.util';
import { TransactionAmounts } from '../transaction-amounts/transaction-amounts';
import type { Contact, LoadedAccount } from '../../models/account';

function partiesKnownBy(user: LoadedAccount): Contact[] {
  const myEcosystems = (user.myEcosystems ?? []).map((ecosystem): Contact => ({
    name: ecosystem.name,
    pk: ecosystem.publickey,
    url: user.serverUrl,
    type: 'ecosystem',
  }))
  return [...user.contacts, ...myEcosystems]
}

@Component({
  selector: 'app-transaction-list',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatButtonModule,
    MatTableModule,
    TransactionAmounts,
    MatCardModule,
  ],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.css',
})
export class TransactionList {
  userService = inject(ConnectedUserService)

  user: any
  displayedColumns: string[] = ['date', 'type', 'source', 'target', 'amount']
  dataSource: DisplayRow[] = []

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }

    const knownParties = partiesKnownBy(this.user)
    this.dataSource = this.user.blockchain.getHistory()
      .map((tx: any) => toDisplayRow(tx, this.user.blockchain.getMyPublicKey(), knownParties))
  }
}