import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/**
 * Shell for the four permanent tabs (Phase-1.md §7 navigation card:
 * Accueil · Paiement · Contacts · Réglages). Secondary screens reached from
 * within a tab (add-contact, pay-offline, print-papers…) open on top of this,
 * outside the child routes below, so they get a back arrow instead of the bar.
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout { }
