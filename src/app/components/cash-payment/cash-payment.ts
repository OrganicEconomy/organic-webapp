import { Component } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import {MatButtonModule} from '@angular/material/button';

@Component({
  selector: 'app-cash-payment',
  imports: [
    MatTableModule,
    MatButtonModule
  ],
  templateUrl: './cash-payment.html',
  styleUrl: './cash-payment.css',
})
export class CashPayment {
  displayedColumns: string[] = ['date', 'id', 'emitter', 'amount', 'cash']
  dataSource = [
    {
      date: "12/12/1212",
      id: "02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3",
      emitter: "02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3",
      amount: 12
    }
  ]
}
