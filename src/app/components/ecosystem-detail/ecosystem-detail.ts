import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';
import { resolveContactName } from '../../services/resolve-contact-name.util';
import { extractServerErrorMessage } from '../../services/server-error.util';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';

interface InvestHorizon {
  label: string
  count: number
}

@Component({
  selector: 'app-ecosystem-detail',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
  ],
  templateUrl: './ecosystem-detail.html',
  styleUrl: './ecosystem-detail.css',
})
export class EcosystemDetail {
  userService = inject(ConnectedUserService);
  server = inject(ServerConnexionService);
  viewedEcosystemService = inject(ViewedEcosystemService);
  private dialog = inject(MatDialog);
  private _snackBar = inject(MatSnackBar);

  user: any;
  ecosystemPk = '';
  loadError = '';

  name = '';
  roleLabel = '';
  isAdmin = false;
  isPayer = false;
  balance = 0;
  affordableInvests = 0;
  upcomingInvests: InvestHorizon[] = [];
  admins: string[] = [];
  payers: string[] = [];
  actorCount = 0;

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
        this.name = info.name;
        this.populate();
      },
      error: () => {
        this.loadError = "Impossible de récupérer cet écosystème.";
      },
    });
  }

  private populate(): void {
    const blockchain = this.viewedEcosystemService.getViewedEcosystem()!.blockchain;

    this.roleLabel = this.computeRoleLabel(blockchain);
    this.isAdmin = blockchain.isAdmin(this.user.publickey);
    this.isPayer = blockchain.isPayer(this.user.publickey);
    this.balance = blockchain.getAvailableMoneyAmount();
    this.affordableInvests = blockchain.getAffordableInvestAmount();
    this.upcomingInvests = this.computeUpcomingInvests(blockchain);
    this.admins = [...blockchain.getAdmins() as Set<string>].map((pk) => resolveContactName(pk, this.user.contacts, this.user.publickey));
    this.payers = [...(blockchain.getPayers() as Map<string, number>).keys()].map((pk) => resolveContactName(pk, this.user.contacts, this.user.publickey));
    this.actorCount = blockchain.getActors().size;
  }

  private computeRoleLabel(blockchain: any): string {
    const roles: string[] = [];
    if (blockchain.isAdmin(this.user.publickey)) roles.push('Admin');
    if (blockchain.isActor(this.user.publickey)) roles.push('Actant');
    if (blockchain.isPayer(this.user.publickey)) roles.push('Payant');
    return roles.length > 0 ? roles.join(', ') : 'Aucun rôle';
  }

  private computeUpcomingInvests(blockchain: any): InvestHorizon[] {
    const today = new Date();
    const horizons = [
      { label: "Aujourd'hui", days: 0 },
      { label: 'Demain', days: 1 },
      { label: 'Dans 7 jours', days: 7 },
      { label: 'Dans 30 jours', days: 30 },
    ];
    return horizons.map(({ label, days }) => {
      const date = new Date(today);
      date.setDate(date.getDate() + days);
      return { label, count: blockchain.getAffordableInvestAmount(date) };
    });
  }

  distributeSalary(): void {
    if (this.userService.isReadOnlySession()) {
      this.displayMessage("Ce compte est actif sur un autre appareil — lecture seule.");
      return;
    }
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data: { title: 'Distribuer les salaires', message: 'Distribuer les salaires maintenant ?' },
    });
    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      const sk = this.userService.getSecretKey();
      this.server.distributeSalary(this.user.serverUrl, this.ecosystemPk, this.user.publickey, sk).subscribe({
        next: () => {
          this.displayMessage("Salaires distribués avec succès.");
          this.fetchAndPopulate();
        },
        error: (err) => {
          console.log(err);
          this.displayMessage(extractServerErrorMessage(err) ?? "La distribution a échoué — réessayez plus tard.");
        },
      });
    });
  }

  displayMessage(message: string): void {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }
}
