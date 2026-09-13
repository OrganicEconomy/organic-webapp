import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { CitizenBlockchain } from 'organic-money/src/index.js';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';

@Component({
  selector: 'app-validation-detail',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
  ],
  templateUrl: './validation-detail.html',
  styleUrl: './validation-detail.css',
})
export class ValidationDetail {
  userService = inject(ConnectedUserService);
  server = inject(ServerConnexionService);

  user: any;
  candidatePk = '';
  candidateName = '';
  loadError = '';
  actionError = '';

  private blocks: unknown[] = [];

  constructor(private route: ActivatedRoute, private router: Router) {
    this.user = this.userService.getConnectedUser();
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return;
    }

    this.candidatePk = this.route.snapshot.paramMap.get('pk') ?? '';
    const sk = this.userService.getSecretKey();
    this.server.getValidationDetail(this.user.serverUrl, this.candidatePk, this.user.publickey, sk).subscribe({
      next: (detail) => {
        this.candidateName = detail.name;
        this.blocks = detail.blocks;
      },
      error: () => {
        this.loadError = "Impossible de récupérer ce candidat.";
      },
    });
  }

  approve(): void {
    const sk = this.userService.getSecretKey();
    const candidateChain = new CitizenBlockchain(this.blocks);
    const initBlock = candidateChain.validateAccount(sk);

    this.server.approveValidation(this.user.serverUrl, this.candidatePk, this.user.publickey, sk, initBlock).subscribe({
      next: () => { this.router.navigate(['/validations']); },
      error: () => { this.actionError = "Échec de la validation."; },
    });
  }

  reject(): void {
    const sk = this.userService.getSecretKey();

    this.server.rejectValidation(this.user.serverUrl, this.candidatePk, this.user.publickey, sk).subscribe({
      next: () => { this.router.navigate(['/validations']); },
      error: () => { this.actionError = "Échec du refus."; },
    });
  }
}
