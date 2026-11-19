import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';
import { DisplayRow, toDisplayRow, withoutRepeats } from '../../utils/transaction-display.util';
import { TransactionAmounts } from '../transaction-amounts/transaction-amounts';
import { HistoryEntry, MonthHeading, hasType, matchesSearch, withMonthHeadings } from '../../utils/history-filter.util';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
    MatCardModule,
    TransactionAmounts,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.css',
})
export class TransactionList {
  userService = inject(ConnectedUserService)

  user: any
  displayedColumns: string[] = ['date', 'type', 'source', 'target', 'amount']
  rows: DisplayRow[] = []
  typeChoices: string[] = []
  search = signal('')
  chosenType = signal<string | null>(null)

  private isShown(row: DisplayRow): boolean {
    return matchesSearch(row, this.search()) && hasType(row, this.chosenType())
  }

  entries = computed(() => withMonthHeadings(this.rows.filter((row) => this.isShown(row))))

  isMonthHeading = (_index: number, entry: HistoryEntry): entry is MonthHeading => 'heading' in entry

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }

    const knownParties = partiesKnownBy(this.user)
    this.rows = withoutRepeats(this.user.blockchain.getHistory())
      .map((tx: any) => toDisplayRow(tx, this.user.blockchain.getMyPublicKey(), knownParties))
    this.typeChoices = [...new Set(this.rows.map((row) => row.type))]
  }
}