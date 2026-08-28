import { Component, inject, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { encodeValidationQr } from 'organic-protocol';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { QRCodeComponent } from 'angularx-qrcode';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-pending-validation',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    QRCodeComponent,
  ],
  templateUrl: './pending-validation.html',
  styleUrl: './pending-validation.css',
})
export class PendingValidation implements OnDestroy {
  private static readonly STATUS_POLL_INTERVAL_MS = 30000;

  userService = inject(ConnectedUserService);
  server = inject(ServerConnexionService);
  localDB = inject(LocalDatabaseService);

  user: any;
  qrData = '';

  private pollSubscription?: Subscription;

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser();
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return;
    }

    if (this.user.status === 'rejected') {
      return;
    }

    this.qrData = encodeValidationQr({ pk: this.user.publickey, url: this.user.serverUrl, n: this.user.name });
    this.checkStatus();
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  private checkStatus(): void {
    this.pollSubscription = this.server.getValidationStatus(this.user.serverUrl, this.user.publickey).subscribe({
      next: (res) => {
        if (res.status !== this.user.status) {
          this.user.status = res.status;
          this.localDB.saveUser(this.user);
        }
        if (res.status === 'active') {
          this.router.navigate(['/home']);
          return;
        }
        if (res.status === 'rejected') {
          return;
        }
        this.scheduleNextCheck();
      },
      error: () => this.scheduleNextCheck(),
    });
  }

  private scheduleNextCheck(): void {
    this.pollSubscription = timer(PendingValidation.STATUS_POLL_INTERVAL_MS).subscribe(() => this.checkStatus());
  }
}
