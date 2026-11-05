import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ConnectedUserService } from '../../services/connected-user.service';
import type { Contact } from '../../models/account';

@Component({
  selector: 'app-contacts',
  imports: [
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './contacts.html',
  styleUrl: './contacts.css',
})
export class Contacts {
  userService = inject(ConnectedUserService)
  user = this.userService.getConnectedUser()

  constructor(private router: Router) {
    if (this.user === null) {
      this.router.navigate(['/user-selection']);
      return
    }
  }

  displayedColumns: string[] = ['name', 'pk']
  search = signal('')
  visibleContacts = computed<Contact[]>(() =>
    this.user.contacts.filter((contact: Contact) => nameContains(contact, this.search())).sort(byName),
  )

  truncate(pk: string): string {
    if (!pk || pk.length <= 12) return pk;
    return `${pk.slice(0, 5)}…${pk.slice(-5)}`;
  }
}

function byName(first: Contact, second: Contact): number {
  return first.name.localeCompare(second.name, 'fr', { sensitivity: 'base' })
}

function nameContains(contact: Contact, search: string): boolean {
  return comparable(contact.name).includes(comparable(search.trim()))
}

function comparable(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
