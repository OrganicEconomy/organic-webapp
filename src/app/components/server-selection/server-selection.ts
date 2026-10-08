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
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from "rxjs";

const VISIBLE_ROWS = 6

type ServerSelectionStep = 'choose' | 'verify'

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
    MatDividerModule,
  ],
  templateUrl: './server-selection.html',
  styleUrl: './server-selection.css',
})
export class ServerSelection {
  private server = inject(ServerConnexionService)
  private router = inject(Router)

  readonly visibleRows = VISIBLE_ROWS

  knownServers: ServerListEntry[] = []
  selectedServerUrl = ''
  selectedServerName = ''
  customUrl = ''
  useCustom = false

  step: ServerSelectionStep = 'choose'
  verifying = false
  verifiedInfo: InfoResponse | null = null
  error = ''

  private verifySub?: Subscription

  constructor() {
    this.server.getKnownServers(environment.serverUrl).subscribe({
      next: (servers) => {
        this.knownServers = servers
        if (servers.length > 0) {
          this.selectedServerUrl = servers[0].url
          this.selectedServerName = servers[0].name
        } else {
          // No directory to show — go straight to the URL field, same as the
          // unreachable-root-server case below.
          this.showCustom()
        }
      },
      // The root server is just a convenience directory — being unreachable
      // shouldn't block someone who wants to type a server URL directly.
      error: () => { this.useCustom = true },
    })
  }

  get hasKnownServer() {
    return this.knownServers.length > 0
  }

  selectServer(server: ServerListEntry): void {
    const rawUrl = server.url
    let url: string
    try {
      url = normalizeServerUrl(rawUrl)
    } catch {
      this.error = "Cette adresse n'a pas l'air valide."
      return
    }

    this.selectedServerUrl = url
    this.selectedServerName = server.name
    this.step = 'verify'
    this.verify()
  }

  showCustom(): void {
    this.error = ''
    this.useCustom = true
  }

  submitCustom(): void {
    this.selectServer({
      url: this.customUrl,
      name: '',
    })
  }

  backToServerChoice(forceUseCustom?: boolean): void {
    this.verifySub?.unsubscribe()
    this.verifying = false
    this.verifiedInfo = null
    this.error = ''
    this.step = 'choose'
    this.useCustom = forceUseCustom || !this.hasKnownServer
  }

  verify(): void {
    this.verifySub?.unsubscribe()
    this.verifiedInfo = null
    this.error = ''
    this.verifying = true
    this.verifySub = this.server.getServerInfo(this.selectedServerUrl).subscribe({
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
    this.router.navigate(['/signup'], { queryParams: { server: this.selectedServerUrl } })
  }

  restoreAccount(): void {
    this.router.navigate(['/restore-account'], { queryParams: { server: this.selectedServerUrl } })
  }
}
