import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { requestedAgo } from '../../utils/requested-ago.util';
import type { ValidationListEntry } from 'organic-protocol';

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

  requestedAgo = requestedAgo;
}
