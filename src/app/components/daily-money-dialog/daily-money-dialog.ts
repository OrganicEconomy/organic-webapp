import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface DailyMoneyDialogData {
  created: number;
  cashed: number;
}

@Component({
  selector: 'app-daily-money-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './daily-money-dialog.html',
  styleUrl: '../celebration-dialog.css',
})
export class DailyMoneyDialog {
  data = inject<DailyMoneyDialogData>(MAT_DIALOG_DATA);
}
