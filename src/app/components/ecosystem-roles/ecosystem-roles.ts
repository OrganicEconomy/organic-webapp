import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';
import { BackupService } from '../../services/backup.service';
import { resolveContactName } from '../../services/resolve-contact-name.util';
import { extractServerErrorMessage, duplicateTransactionMessage } from '../../services/server-error.util';

type RoleType = 'admin' | 'actor' | 'payer';

interface RoleHolder {
  pk: string;
  name: string;
}

@Component({
  selector: 'app-ecosystem-roles',
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatCheckboxModule,
  ],
  templateUrl: './ecosystem-roles.html',
  styleUrl: './ecosystem-roles.css',
})
export class EcosystemRoles {
  userService = inject(ConnectedUserService);
  server = inject(ServerConnexionService);
  viewedEcosystemService = inject(ViewedEcosystemService);
  backupService = inject(BackupService);
  private _snackBar = inject(MatSnackBar);

  user: any;
  ecosystemPk = '';
  loadError = '';

  isAdmin = false;
  admins: RoleHolder[] = [];
  actors: RoleHolder[] = [];
  payers: RoleHolder[] = [];

  roleType: RoleType = 'admin';
  targetPk = '';
  ratio = 1;
  cap = 0;
  capUnlimited = false;

  constructor(private route: ActivatedRoute, private router: Router) {
    this.user = this.userService.getConnectedUser();
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return;
    }

    this.ecosystemPk = this.route.snapshot.paramMap.get('pk') ?? '';
    this.fetchAndPopulate();
  }

  private fetchAndPopulate(): void {
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
    const blockchain = this.viewedEcosystemService.getViewedEcosystem()!.blockchain;

    this.isAdmin = blockchain.isAdmin(this.user.publickey);
    this.admins = [...blockchain.getAdmins() as Set<string>].map((pk) => this.toRoleHolder(pk));
    this.actors = [...(blockchain.getActors() as Map<string, number>).keys()].map((pk) => this.toRoleHolder(pk));
    this.payers = [...(blockchain.getPayers() as Map<string, number>).keys()].map((pk) => this.toRoleHolder(pk));
  }

  private toRoleHolder(pk: string): RoleHolder {
    return { pk, name: resolveContactName(pk, this.user.contacts, this.user.publickey) };
  }

  removeRole(role: RoleType, pk: string): void {
    this.sendRoleTx(() => {
      const chain = this.user.blockchain;
      if (role === 'admin') return chain.unsetAdmin(this.userService.getSecretKey(), this.ecosystemPk, pk);
      if (role === 'actor') return chain.unsetActor(this.userService.getSecretKey(), this.ecosystemPk, pk);
      return chain.unsetPayer(this.userService.getSecretKey(), this.ecosystemPk, pk);
    });
  }

  addRole(): void {
    if (!this.targetPk) {
      this.displayMessage("Choisissez un contact.");
      return;
    }
    if (this.roleType === 'actor' && this.isInvalidRatioOrCap(this.ratio)) {
      this.displayMessage("Le ratio doit être un nombre entier positif ou nul.");
      return;
    }
    if (this.roleType === 'payer' && !this.capUnlimited && this.isInvalidRatioOrCap(this.cap)) {
      this.displayMessage("Le plafond doit être un nombre entier positif ou nul.");
      return;
    }
    this.sendRoleTx(() => {
      const chain = this.user.blockchain;
      const sk = this.userService.getSecretKey();
      if (this.roleType === 'admin') return chain.setAdmin(sk, this.ecosystemPk, this.targetPk);
      if (this.roleType === 'actor') return chain.setActor(sk, this.ecosystemPk, this.targetPk, this.ratio);
      const cap = this.capUnlimited ? -1 : this.cap;
      return chain.setPayer(sk, this.ecosystemPk, this.targetPk, cap);
    });
  }

  private isInvalidRatioOrCap(value: number): boolean {
    return !Number.isInteger(value) || value < 0;
  }

  private sendRoleTx(buildTx: () => any): void {
    if (this.userService.isReadOnlySession()) {
      this.displayMessage("Ce compte est actif sur un autre appareil — lecture seule.");
      return;
    }
    try {
      const sk = this.userService.getSecretKey();
      const tx = buildTx();
      const wire = tx.export();

      this.backupService.recordPayment(this.user, sk).subscribe({
        next: () => {
          this.server.sendEcosystemTx(this.user.serverUrl, this.ecosystemPk, wire).subscribe({
            next: () => {
              this.displayMessage("Action enregistrée et envoyée avec succès.");
              this.fetchAndPopulate();
            },
            error: (err) => {
              console.log(err);
              this.displayMessage(extractServerErrorMessage(err) ?? "Action enregistrée mais non transmise — réessayez plus tard.");
            },
          });
        },
        error: (err) => {
          console.log(err);
          this.displayMessage(extractServerErrorMessage(err) ?? "Action faite localement mais pas sauvegardée sur le serveur.");
        },
      });
    } catch (err) {
      const message = duplicateTransactionMessage(err);
      if (message) {
        this.displayMessage(message);
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
