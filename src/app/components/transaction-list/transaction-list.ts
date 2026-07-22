import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { ConnectedUserService } from '../../services/connected-user.service';
import { toDisplayRow } from '../../utils/transaction-display.util';

@Component({
  selector: 'app-transaction-list',
  imports: [
    MatTableModule,
    MatCardModule,
  ],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.css',
})
export class TransactionList {
  userService = inject(ConnectedUserService)

  user: any
  displayedColumns: string[] = ['date', 'type', 'source', 'target', 'amount']
  dataSource: any[] = []

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }

    this.dataSource = this.user.blockchain.getHistory()
      .map((tx: any) => toDisplayRow(tx, this.user.blockchain.getMyPublicKey(), this.user.contacts))
  }
}