import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { InfoResponse, ServerListEntry } from 'organic-protocol';
import { normalizeServerUrl } from 'organic-protocol';
import { ServerConnexionService } from '../../services/server-connection.service';
import { environment } from '../../../environments/environment';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-server-selection',
  imports: [
    FormsModule,
    MatCardModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './server-selection.html',
  styleUrl: './server-selection.css',
})
export class ServerSelection {
  private server = inject(ServerConnexionService)
  private router = inject(Router)

  knownServers: ServerListEntry[] = []
  selectedUrl = ''
  customUrl = ''
  useCustom = false

  verifying = false
  verifiedInfo: InfoResponse | null = null
  error = ''

  constructor() {
    this.server.getKnownServers(environment.serverUrl).subscribe({
      next: (servers) => {
        this.knownServers = servers
        if (servers.length > 0) this.selectedUrl = servers[0].url
      },
      // The root server is just a convenience directory — being unreachable
      // shouldn't block someone who wants to type a server URL directly.
      error: () => { this.useCustom = true },
    })
  }

  get chosenUrl(): string {
    return this.useCustom ? this.customUrl : this.selectedUrl
  }

  verify(): void {
    this.verifiedInfo = null
    this.error = ''

    let url: string
    try {
      url = normalizeServerUrl(this.chosenUrl)
    } catch {
      this.error = "Cette adresse n'a pas l'air valide."
      return
    }

    this.verifying = true
    this.server.getServerInfo(url).subscribe({
      next: (info) => {
        this.verifiedInfo = info
        this.verifying = false
      },
      error: () => {
        this.error = "Impossible de contacter ce serveur."
        this.verifying = false
      },
    })
  }

  createAccount(): void {
    this.router.navigate(['/signup'], { queryParams: { server: this.chosenUrl } })
  }

  restoreAccount(): void {
    this.router.navigate(['/restore-account'], { queryParams: { server: this.chosenUrl } })
  }
}
