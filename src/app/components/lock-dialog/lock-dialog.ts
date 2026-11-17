import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';
import { PageReopenerService } from '../../services/page-reopener.service';

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
  private router = inject(Router);

  password = '';
  error = '';

  async unlock(): Promise<void> {
    if (!(await this.userService.unlock(this.password))) {
      this.error = 'Mot de passe incorrect.';
      return;
    }
    this.dialogRef.close();
    await this.pageReopener.reopenCurrentPage();
  }

  changeAccount(): void {
    this.dialogRef.close();
    this.router.navigate(['/logout']);
  }
}
