import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';
import { resolveContactName } from '../../services/resolve-contact-name.util';

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

  user: any;
  ecosystemPk = '';
  loadError = '';

  name = '';
  roleLabel = '';
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
    this.balance = blockchain.getAvailableMoneyAmount();
    this.affordableInvests = blockchain.getAffordableInvestAmount();
    this.upcomingInvests = this.computeUpcomingInvests(blockchain);
    this.admins = [...blockchain.getAdmins() as Set<string>].map((pk) => resolveContactName(pk, this.user.contacts));
    this.payers = [...(blockchain.getPayers() as Map<string, number>).keys()].map((pk) => resolveContactName(pk, this.user.contacts));
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
}
