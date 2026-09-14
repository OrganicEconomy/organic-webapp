import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { BackupService } from '../../services/backup.service';

type Pocket = 'invests' | 'money';

@Component({
  selector: 'app-ecosystem-invest',
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
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
  pocket: Pocket = 'invests';
  dailyAmount = 0;
  days = 1;

  constructor(private route: ActivatedRoute, private router: Router) {
    this.user = this.userService.getConnectedUser();
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return;
    }
    this.ecosystemPk = this.route.snapshot.paramMap.get('pk') ?? '';
  }

  get max(): number {
    return this.pocket === 'invests'
      ? this.user.blockchain.getAffordableInvestAmount()
      : this.user.blockchain.getAffordableMoneyAmount();
  }

  engage(): void {
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
    try {
      const sk = this.userService.getSecretKey();
      const tx = this.pocket === 'invests'
        ? this.user.blockchain.engageInvests(sk, this.ecosystemPk, this.dailyAmount, this.days)
        : this.user.blockchain.engageMoney(sk, this.ecosystemPk, this.dailyAmount, this.days);

      this.backupService.recordPayment(this.user, sk).subscribe({
        next: () => {
          this.server.sendEcosystemTx(this.user.serverUrl, this.ecosystemPk, tx.export()).subscribe({
            next: () => {
              this.displayMessage("Engagement enregistré et envoyé avec succès.");
              this.router.navigate(['/ecosystems', this.ecosystemPk]);
            },
            error: (err) => {
              console.log(err);
              this.displayMessage("Engagement enregistré mais non transmis — réessayez plus tard.");
            },
          });
        },
        error: (err) => {
          console.log(err);
          this.displayMessage("Engagement fait localement mais pas sauvegardé sur le serveur.");
        },
      });
    } catch (err) {
      console.log(err);
      this.displayMessage("Une erreur est survenue oO");
    }
  }

  displayMessage(message: string): void {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }
}
