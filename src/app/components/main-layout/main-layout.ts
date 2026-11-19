import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, isActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConnectedUserService, ReadOnlyReason } from '../../services/connected-user.service';
import { PageReopenerService } from '../../services/page-reopener.service';

const PAY_SECTION = ['/pay', '/pay-offline', '/receive-offline', '/cashpapers', '/printpapers', '/transactions'];

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  private userService = inject(ConnectedUserService);
  private pageReopener = inject(PageReopenerService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private payPagesActive = PAY_SECTION.map((page) =>
    isActive(page, this.router, { paths: 'exact', queryParams: 'ignored' }),
  );

  isInThePaySection(): boolean {
    return this.payPagesActive.some((isPageActive) => isPageActive());
  }

  private isExplainedByTheBanner(reason: ReadOnlyReason | null): boolean {
    return reason !== null && reason !== 'locked';
  }

  readOnlyBannerMessage(): string | null {
    if (!this.isExplainedByTheBanner(this.userService.readOnlyReason())) {
      return null;
    }
    return this.userService.readOnlyMessage();
  }

  isInUseInAnotherTab(): boolean {
    return this.userService.readOnlyReason() === 'other-tab';
  }

  async useThisTab(): Promise<void> {
    try {
      await this.userService.useThisTab();
    } catch (error) {
      console.error(error);
      this.snackBar.open("Impossible de reprendre le compte dans cet onglet : reconnectez-vous depuis l'écran de connexion.", 'Fermer');
      return;
    }
    await this.pageReopener.reopenCurrentPage();
  }
}
