import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ConnectedUserService } from '../../services/connected-user.service';

/**
 * Shell for the four permanent tabs (Accueil · Paiement · Contacts · Mon
 * compte — renamed from Phase-1.md §7's original "Réglages", now a merged
 * identity+settings hub). Secondary screens reached from within a tab
 * (add-contact, pay-offline, print-papers…) open on top of this, outside the
 * child routes below, so they get a back arrow instead of the bar.
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  userService = inject(ConnectedUserService);
  private router = inject(Router);

  isTakenOverByAnotherTab(): boolean {
    return this.userService.readOnlyReason() === 'other-tab';
  }

  private async reopenCurrentPage(): Promise<void> {
    const currentPage = this.router.url;
    await this.router.navigateByUrl('/user-selection', { skipLocationChange: true });
    await this.router.navigateByUrl(currentPage);
  }

  async useThisTab(): Promise<void> {
    await this.userService.useThisTab();
    await this.reopenCurrentPage();
  }
}
