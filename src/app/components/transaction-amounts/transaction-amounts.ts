import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type Amounts, type Engagement, withSign } from '../../utils/transaction-display.util';

function investsUnit(count: number): string {
  return count > 1 ? 'investissements' : 'investissement';
}

function daysUnit(days: number): string {
  return days > 1 ? 'jours' : 'jour';
}

@Component({
  selector: 'app-transaction-amounts',
  imports: [MatIconModule],
  templateUrl: './transaction-amounts.html',
  styleUrl: './transaction-amounts.css',
})
export class TransactionAmounts {
  amounts = input.required<Amounts>();
  withSign = withSign;

  signedInvests(): string {
    const invests = this.amounts().invests;
    return `${withSign(invests)} ${investsUnit(invests)}`;
  }

  investsHeldBack({ invests, days, isSpreadEvenly }: Engagement): string {
    if (!isSpreadEvenly) {
      return `${invests} ${investsUnit(invests)} sur ${days} ${daysUnit(days)}`;
    }
    const investsPerDay = invests / days;
    return `${investsPerDay} ${investsUnit(investsPerDay)}/jour pendant ${days} ${daysUnit(days)}`;
  }
}
