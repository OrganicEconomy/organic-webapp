import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';
import { PageReopenerService } from '../../services/page-reopener.service';
import { ChainSyncService } from '../../services/chain-sync.service';

@Component({
  selector: 'app-lock-dialog',
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './lock-dialog.html',
  styleUrl: './lock-dialog.css',
})
export class LockDialog {
  private userService = inject(ConnectedUserService);
  private dialogRef = inject(MatDialogRef<LockDialog>);
  private pageReopener = inject(PageReopenerService);
  private chainSync = inject(ChainSyncService);
  private router = inject(Router);

  password = '';
  unlockError = '';

  unlocking = false;

  private async tryToUnlock(): Promise<void> {
    const isUnlocked = await this.userService.unlock(this.password);
    if (!isUnlocked) {
      this.unlockError = 'Mot de passe incorrect.';
      return;
    }
    await this.chainSync.syncTheConnectedAccount();
    await this.pageReopener.reopenCurrentPage();
    this.dialogRef.close();
  }

  async unlock(): Promise<void> {
    if (this.unlocking) {
      return;
    }
    this.unlocking = true;
    try {
      await this.tryToUnlock();
    } finally {
      this.unlocking = false;
    }
  }

  changeAccount(): void {
    this.dialogRef.close();
    this.router.navigate(['/logout']);
  }
}
