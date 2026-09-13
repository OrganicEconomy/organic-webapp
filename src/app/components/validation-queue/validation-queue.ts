import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import type { ValidationListEntry } from 'organic-protocol';

const MS_PER_HOUR = 3600000;

@Component({
  selector: 'app-validation-queue',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
  ],
  templateUrl: './validation-queue.html',
  styleUrl: './validation-queue.css',
})
export class ValidationQueue {
  userService = inject(ConnectedUserService);
  server = inject(ServerConnexionService);

  user: any;
  candidates: ValidationListEntry[] = [];

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser();
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return;
    }

    const sk = this.userService.getSecretKey();
    this.server.getValidationList(this.user.serverUrl, this.user.publickey, sk).subscribe({
      next: (list) => { this.candidates = list; },
      error: () => { this.candidates = []; },
    });
  }

  requestedAgo(requestedAt: string): string {
    const elapsedHours = Math.floor((Date.now() - new Date(requestedAt).getTime()) / MS_PER_HOUR);
    if (elapsedHours < 1) return "il y a moins d'une heure";
    if (elapsedHours < 24) return `il y a ${elapsedHours}h`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays === 1) return 'hier';
    return `il y a ${elapsedDays} jours`;
  }
}
