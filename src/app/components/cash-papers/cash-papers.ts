import { Component } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-cash-papers',
  imports: [
    MatTableModule,
    MatButtonModule
  ],
  templateUrl: './cash-papers.html',
  styleUrl: './cash-papers.css',
})
export class CashPapers {
  displayedColumns: string[] = ['id', 'emitter', 'amount']
  dataSource = [
    {
      id: "02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3",
      emitter: "02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3",
      amount: 12
    }
  ]
}
