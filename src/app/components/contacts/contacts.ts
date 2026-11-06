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
import { contactsFile } from '../../utils/contacts-file.util';

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

  exportContacts(): void {
    const file = new Blob([contactsFile(this.user.contacts)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(file)
    link.download = contactsFileName(this.user.name, new Date())
    link.click()
    URL.revokeObjectURL(link.href)
  }

  truncate(pk: string): string {
    if (!pk || pk.length <= 12) return pk;
    return `${pk.slice(0, 5)}…${pk.slice(-5)}`;
  }
}

function contactsFileName(userName: string, day: Date): string {
  return `contacts-${slug(userName)}-${isoDay(day)}.json`
}

function slug(text: string): string {
  return comparable(text).replace(/[^a-z0-9]+/g, '-')
}

function isoDay(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${dayOfMonth}`
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
