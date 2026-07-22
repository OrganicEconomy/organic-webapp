import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface LevelUpDialogData {
  oldLevel: number;
  newLevel: number;
}

@Component({
  selector: 'app-level-up-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './level-up-dialog.html',
  styleUrl: './level-up-dialog.css',
})
export class LevelUpDialog {
  dialogRef = inject<MatDialogRef<LevelUpDialog>>(MatDialogRef<LevelUpDialog>);
  data = inject<LevelUpDialogData>(MAT_DIALOG_DATA);
}
