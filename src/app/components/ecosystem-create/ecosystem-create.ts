import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';
import { GeolocationService } from '../../services/geolocation.service';
import type { EcosystemInfoResponse } from 'organic-protocol';

@Component({
  selector: 'app-ecosystem-create',
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  templateUrl: './ecosystem-create.html',
  styleUrl: './ecosystem-create.css',
})
export class EcosystemCreate {
  userService = inject(ConnectedUserService);
  server = inject(ServerConnexionService);
  viewedEcosystem = inject(ViewedEcosystemService);
  geolocation = inject(GeolocationService);

  user: any;
  name = '';
  description = '';
  usePosition = false;
  actionError = '';

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser();
    if (!this.user) {
      this.router.navigate(['/user-selection']);
    }
  }

  async create(): Promise<void> {
    const sk = this.userService.getSecretKey();
    let lat: number | undefined;
    let lng: number | undefined;
    if (this.usePosition) {
      const position = await this.geolocation.getCurrentPosition();
      lat = position?.lat;
      lng = position?.lng;
    }

    this.server.createEcosystem(this.user.serverUrl, this.user.publickey, sk, this.name, this.description || undefined, lat, lng).subscribe({
      next: (response) => {
        const info: EcosystemInfoResponse = {
          publickey: response.publickey,
          name: this.name,
          description: this.description || null,
          lat: lat ?? null,
          lng: lng ?? null,
          iscore: response.iscore,
          blocks: response.blocks,
        };
        this.viewedEcosystem.setViewedEcosystem(info);
        this.userService.refreshMyEcosystems();
        this.router.navigate(['/ecosystems', response.publickey]);
      },
      error: () => { this.actionError = "Échec de la création."; },
    });
  }
}
