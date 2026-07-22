import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { LevelUpDialog } from '../components/level-up-dialog/level-up-dialog';

@Injectable({ providedIn: 'root' })
export class LevelUpService {
  private dialog = inject(MatDialog);

  celebrateIfLevelUp(oldLevel: number, newLevel: number): void {
    if (newLevel > oldLevel) {
      this.dialog.open(LevelUpDialog, { data: { oldLevel, newLevel } });
    }
  }
}
