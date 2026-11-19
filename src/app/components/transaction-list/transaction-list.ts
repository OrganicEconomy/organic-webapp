import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ConnectedUserService } from '../../services/connected-user.service';
import { DisplayRow, newestFirst, toDisplayRow, withoutRepeats } from '../../utils/transaction-display.util';
import {
  ALL_TYPES,
  HistoryEntry,
  isMonthHeading,
  matchesSearch,
  matchesType,
  withMonthHeadings,
} from '../../utils/history-entries.util';
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

function typesFoundIn(rows: DisplayRow[]): string[] {
  return [...new Set(rows.map((row) => row.label))]
}

const PARTY_COLUMNS = ['source', 'target']

function isRowWithoutParties(entry: HistoryEntry): boolean {
  return !isMonthHeading(entry) && entry.parties === null
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
  displayedColumns: string[] = ['date', 'type', ...PARTY_COLUMNS, 'amount']
  columnsWithoutParties: string[] = ['date', 'type', 'amount']
  typeSpanWithoutParties = 1 + PARTY_COLUMNS.length
  rows: DisplayRow[] = []
  typeChoices: string[] = []
  search = signal('')
  chosenType = signal(ALL_TYPES)
  allTypes = ALL_TYPES

  private isVisible(row: DisplayRow): boolean {
    return matchesSearch(row, this.search()) && matchesType(row, this.chosenType())
  }

  entries = computed(() => withMonthHeadings(this.rows.filter((row) => this.isVisible(row))))

  hasNoTransactions(): boolean {
    return this.rows.length === 0
  }

  hasNoMatch(): boolean {
    return this.entries().length === 0
  }

  isMonthHeading = isMonthHeading
  isMonthHeadingRow = (_index: number, entry: HistoryEntry) => isMonthHeading(entry)
  isRowWithoutParties = (_index: number, entry: HistoryEntry) => isRowWithoutParties(entry)

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }

    const knownParties = partiesKnownBy(this.user)
    this.rows = newestFirst(withoutRepeats(this.user.blockchain.getHistory()))
      .map((tx: any) => toDisplayRow(tx, this.user.blockchain.getMyPublicKey(), knownParties))
    this.typeChoices = typesFoundIn(this.rows)
  }
}