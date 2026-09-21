import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { extractServerErrorMessage, isDuplicateTransactionError } from '../../services/server-error.util';

@Component({
  selector: 'app-ecosystem-order',
  imports: [
    FormsModule,
    RouterLink,
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

  constructor(private route: ActivatedRoute, private router: Router) {
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
    try {
      const sk = this.userService.getSecretKey();
      const invests = this.ecosystemBlockchain.invests.slice(0, this.amount);
      const tx = this.user.blockchain.payerOrder(sk, this.ecosystemPk, this.targetPk, invests);

      this.backupService.recordPayment(this.user, sk).subscribe({
        next: () => {
          this.server.sendEcosystemTx(this.user.serverUrl, this.ecosystemPk, tx.export()).subscribe({
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
        },
        error: (err) => {
          this.submitting = false;
          console.log(err);
          this.displayMessage(extractServerErrorMessage(err) ?? "Ordre fait localement mais pas sauvegardé sur le serveur.");
        },
      });
    } catch (err) {
      this.submitting = false;
      if (isDuplicateTransactionError(err)) {
        this.displayMessage("Cette action a déjà été effectuée aujourd'hui — réessayez demain.");
        return;
      }
      console.log(err);
      this.displayMessage("Une erreur est survenue oO");
    }
  }

  displayMessage(message: string): void {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }
}
