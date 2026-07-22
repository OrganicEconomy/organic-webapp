import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ConnectedUserService } from '../../services/connected-user.service';
import { PendingPaymentsService } from '../../services/pending-payments.service';

@Component({
  selector: 'app-cash-payment',
  imports: [
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './cash-payment.html',
  styleUrl: './cash-payment.css',
})
export class CashPayment {
  userService = inject(ConnectedUserService)
  pending = inject(PendingPaymentsService)

  user: any
  displayedColumns: string[] = ['date', 'source', 'amount', 'cash']

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.updateList()
  }

  get dataSource() {
    return this.pending.dataSource
  }

  updateList() {
    this.pending.refresh()
  }

  cash(hash: string) {
    this.pending.cash(hash)
  }
}