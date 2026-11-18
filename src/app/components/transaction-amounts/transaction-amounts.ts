import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type Amounts, withSign } from '../../utils/transaction-display.util';

@Component({
  selector: 'app-transaction-amounts',
  imports: [MatIconModule],
  templateUrl: './transaction-amounts.html',
  styleUrl: './transaction-amounts.css',
})
export class TransactionAmounts {
  amounts = input.required<Amounts>();
  withSign = withSign;
}
