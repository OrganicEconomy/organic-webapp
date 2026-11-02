import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';
import { BackupService } from '../../services/backup.service';
import { extractServerErrorMessage, duplicateTransactionMessage } from '../../services/server-error.util';

@Component({
  selector: 'app-ecosystem-order',
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './ecosystem-order.html',
  styleUrl: './ecosystem-order.css',
})
export class EcosystemOrder {
  userService = inject(ConnectedUserService);
  server = inject(ServerConnexionService);
  viewedEcosystemService = inject(ViewedEcosystemService);
  backupService = inject(BackupService);
  private _snackBar = inject(MatSnackBar);

  user: any;
  ecosystemPk = '';
  loadError = '';
  max = 0;

  targetPk = '';
  amount = 0;
  submitting = false;

  private ecosystemBlockchain: any;

  constructor(private route: ActivatedRoute, private router: Router, private location: Location) {
    this.user = this.userService.getConnectedUser();
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return;
    }

    this.ecosystemPk = this.route.snapshot.paramMap.get('pk') ?? '';
    this.server.getEcosystemInfo(this.user.serverUrl, this.ecosystemPk).subscribe({
      next: (info) => {
        this.viewedEcosystemService.setViewedEcosystem(info);
        this.populate();
      },
      error: () => {
        this.loadError = "Impossible de récupérer cet écosystème.";
      },
    });
  }

  private populate(): void {
    this.ecosystemBlockchain = this.viewedEcosystemService.getViewedEcosystem()!.blockchain;
    this.max = this.ecosystemBlockchain.getAffordableInvestAmount();
  }

  submitOrder(): void {
    if (this.submitting) return;
    if (!this.targetPk) {
      this.displayMessage("Choisissez un bénéficiaire.");
      return;
    }
    if (this.amount <= 0) {
      this.displayMessage("Le montant doit être supérieur à zéro.");
      return;
    }
    if (this.amount > this.max) {
      this.displayMessage("Ce montant dépasse les investissements disponibles.");
      return;
    }
    if (this.userService.isReadOnlySession()) {
      this.displayMessage("Ce compte est actif sur un autre appareil — lecture seule.");
      return;
    }
    this.submitting = true;
    const sk = this.userService.getSecretKey();
    const invests = this.ecosystemBlockchain.invests.slice(0, this.amount);
    this.backupService.applyAndSave(this.user, sk, () => this.user.blockchain.payerOrder(sk, this.ecosystemPk, this.targetPk, invests).export())
      .subscribe({
        next: (wire) => this.send(wire),
        error: (err) => {
          this.submitting = false;
          console.log(err);
          this.displayMessage(this.cancelledOrderMessage(err));
        },
      });
  }

  private send(wire: any): void {
    this.server.sendEcosystemTx(this.user.serverUrl, this.ecosystemPk, wire).subscribe({
      next: () => {
        this.submitting = false;
        this.displayMessage("Ordre enregistré et envoyé avec succès.");
        this.router.navigate(['/ecosystems', this.ecosystemPk]);
      },
      error: (err) => {
        this.submitting = false;
        console.log(err);
        this.displayMessage(extractServerErrorMessage(err) ?? "Ordre enregistré mais non transmis — réessayez plus tard.");
      },
    });
  }

  private cancelledOrderMessage(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return duplicateTransactionMessage(err) ?? "Une erreur est survenue oO";
    }
    return extractServerErrorMessage(err) ?? "Ordre annulé : rien n'a été enregistré.";
  }

  displayMessage(message: string): void {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }

  goBack(): void {
    this.location.back();
  }
}
