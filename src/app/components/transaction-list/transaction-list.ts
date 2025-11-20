import { Component } from '@angular/core';
import { MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-transaction-list',
  imports: [
    MatTableModule
  ],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.css',
})
export class TransactionList {
  displayedColumns: string[] = ['date', 'type', 'emitter', 'target', 'amount']
  dataSource = [
    {
      date: "12/12/1212",
      type: 1,
      emitter: "02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3",
      target: "02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3",
      amount: 12
    }
  ]
}
