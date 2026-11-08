import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { LocalSaveError } from '../../services/local-database.service';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { BackupService } from '../../services/backup.service';
import { extractServerErrorMessage, isDeviceRevoked } from '../../services/server-error.util';

@Component({
  selector: 'app-ecosystem-invest',
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
  ],
  templateUrl: './ecosystem-invest.html',
  styleUrl: './ecosystem-invest.css',
})
export class EcosystemInvest {
  userService = inject(ConnectedUserService);
  server = inject(ServerConnexionService);
  backupService = inject(BackupService);
  private _snackBar = inject(MatSnackBar);

  user: any;
  ecosystemPk = '';
  dailyAmount = 0;
  days = 1;
  submitting = false;

  constructor(private route: ActivatedRoute, private router: Router, private location: Location) {
    this.user = this.userService.getConnectedUser();
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return;
    }
    this.ecosystemPk = this.route.snapshot.paramMap.get('pk') ?? '';
  }

  goBack(): void {
    this.location.back();
  }

  get max(): number {
    return this.user.blockchain.getAffordableInvestAmount(new Date());
  }

  engage(): void {
    if (this.submitting) return;
    if (this.dailyAmount <= 0) {
      this.displayMessage("Le montant par jour doit être supérieur à zéro.");
      return;
    }
    if (this.days <= 0) {
      this.displayMessage("Le nombre de jours doit être supérieur à zéro.");
      return;
    }
    if (this.userService.isReadOnlySession()) {
      this.displayMessage("Ce compte est actif sur un autre appareil — lecture seule.");
      return;
    }
    this.submitting = true;
    const sk = this.userService.getSecretKey();
    this.backupService.applyAndSave(this.user, sk, () => this.user.blockchain.engageInvests(sk, this.ecosystemPk, this.dailyAmount, this.days))
      .subscribe({
        next: (tx) => this.send(tx),
        error: (err) => {
          this.submitting = false;
          console.log(err);
          this.displayMessage(this.cancelledEngagementMessage(err));
        },
      });
  }

  private cancelledEngagementMessage(err: unknown): string {
    if (err instanceof LocalSaveError) {
      return "Engagement annulé : cet appareil n'a pas pu l'enregistrer.";
    }
    if (!(err instanceof HttpErrorResponse)) {
      return "Une erreur est survenue oO";
    }
    if (isDeviceRevoked(err)) {
      return "Ce compte est actif sur un autre appareil : engagement annulé, rien n'a été enregistré.";
    }
    return "Engagement annulé : rien n'a été enregistré.";
  }

  private send(tx: any): void {
    this.server.sendEcosystemTx(this.user.serverUrl, this.ecosystemPk, tx.export()).subscribe({
      next: () => {
        this.displayMessage("Engagement enregistré et envoyé avec succès.");
        this.router.navigate(['/ecosystems', this.ecosystemPk]);
      },
      error: (err) => {
        this.submitting = false;
        console.log(err);
        this.displayMessage(extractServerErrorMessage(err) ?? "Engagement enregistré mais non transmis — réessayez plus tard.");
      },
    });
  }

  displayMessage(message: string): void {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }
}
