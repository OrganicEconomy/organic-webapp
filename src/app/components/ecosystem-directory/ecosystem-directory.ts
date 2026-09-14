import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { GeolocationService } from '../../services/geolocation.service';
import type { EcosystemListEntry } from 'organic-protocol';

@Component({
  selector: 'app-ecosystem-directory',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
  ],
  templateUrl: './ecosystem-directory.html',
  styleUrl: './ecosystem-directory.css',
})
export class EcosystemDirectory {
  userService = inject(ConnectedUserService);
  server = inject(ServerConnexionService);
  geolocation = inject(GeolocationService);

  user: any;
  ecosystems: EcosystemListEntry[] = [];

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser();
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return;
    }

    this.geolocation.getCurrentPosition().then((position) => {
      this.server.getEcosystemList(this.user.serverUrl, position?.lat, position?.lng).subscribe({
        next: (list) => { this.ecosystems = list; },
        error: () => { this.ecosystems = []; },
      });
    });
  }

  formatDistance(km: number): string {
    return `${km.toFixed(1).replace('.', ',')} km`;
  }
}
