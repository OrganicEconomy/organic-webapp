import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { hasContactWithKey, localRefusal } from '../../utils/contact-refusal.util';
import type { Contact } from '../../models/account';
import { ContactsFileError, contactsFile, contactsFromFile } from '../../utils/contacts-file.util';
import { offerToDownload } from '../../utils/download.util';

const MAX_CONTACTS_FILE_SIZE = 1_000_000

export interface RefusedContact {
  name: string
  reason: string
}

export interface ImportReport {
  added: number
  alreadyKnown: number
  refused: RefusedContact[]
}

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
  localDB = inject(LocalDatabaseService)
  user = this.userService.getConnectedUser()

  constructor(private router: Router) {
    if (this.user === null) {
      this.router.navigate(['/user-selection']);
      return
    }
  }

  displayedColumns: string[] = ['name', 'pk']
  search = signal('')
  contacts = signal<Contact[]>(this.user?.contacts ?? [])
  visibleContacts = computed<Contact[]>(() =>
    this.contacts().filter((contact: Contact) => nameContains(contact, this.search())).sort(byName),
  )

  hasNoContacts(): boolean {
    return this.contacts().length === 0
  }

  exportContacts(): void {
    offerToDownload(contactsFile(this.contacts()), contactsFileName(this.user.name, new Date()), 'application/json')
  }

  importReport = signal<ImportReport | null>(null)
  importError = signal('')

  private forgetPreviousImport(): void {
    this.importError.set('')
    this.importReport.set(null)
  }

  private async textOf(file: File): Promise<string | null> {
    if (file.size > MAX_CONTACTS_FILE_SIZE) {
      this.importError.set('Ce fichier est trop gros pour être un fichier de contacts.')
      return null
    }
    try {
      return await file.text()
    } catch (error) {
      console.error(error)
      this.importError.set('Impossible de lire ce fichier.')
      return null
    }
  }

  private contactsReadFrom(text: string): Contact[] | null {
    try {
      return contactsFromFile(text)
    } catch (error) {
      if (error instanceof ContactsFileError) {
        this.importError.set(error.message)
        return null
      }
      throw error
    }
  }

  private isMyOwnKey(pk: string): boolean {
    return pk === this.user.publickey
  }

  private triage(contacts: Contact[]): { accepted: Contact[], report: ImportReport } {
    const accepted: Contact[] = []
    const refused: RefusedContact[] = []
    let alreadyKnown = 0
    for (const contact of contacts) {
      const knownContacts = [...this.contacts(), ...accepted]
      if (this.isMyOwnKey(contact.pk) || hasContactWithKey(contact.pk, knownContacts)) {
        alreadyKnown++
        continue
      }
      const refusal = localRefusal(contact, knownContacts)
      if (refusal) {
        refused.push({ name: contact.name || this.truncate(contact.pk), reason: refusal })
        continue
      }
      accepted.push(contact)
    }
    return { accepted, report: { added: accepted.length, alreadyKnown, refused } }
  }

  private async saveWith(accepted: Contact[]): Promise<void> {
    await this.localDB.saveWithNewContacts(this.user, accepted)
    this.contacts.set(this.user.contacts)
  }

  private reportFailedSave(error: unknown): void {
    console.error(error)
    this.importError.set("Les contacts n'ont pas pu être enregistrés sur cet appareil : rien n'a été importé.")
  }

  async importContacts(file: File): Promise<void> {
    this.forgetPreviousImport()
    if (this.userService.isReadOnlySession()) {
      this.importError.set(this.userService.readOnlyMessage())
      return
    }
    const text = await this.textOf(file)
    const contacts = text === null ? null : this.contactsReadFrom(text)
    if (contacts === null) {
      return
    }
    const { accepted, report } = this.triage(contacts)
    if (accepted.length > 0) {
      try {
        await this.saveWith(accepted)
      } catch (error) {
        this.reportFailedSave(error)
        return
      }
    }
    this.importReport.set(report)
  }

  async importChosenFile(filePicker: HTMLInputElement): Promise<void> {
    const file = filePicker.files?.[0]
    filePicker.value = ''
    if (file) {
      await this.importContacts(file)
    }
  }

  summaryOf(report: ImportReport): string {
    const parts = [counted(report.added, 'contact ajouté', 'contacts ajoutés')]
    if (report.alreadyKnown > 0) {
      parts.push(counted(report.alreadyKnown, 'déjà présent', 'déjà présents'))
    }
    return parts.join(', ') + '.'
  }

  truncate(pk: string): string {
    if (!pk || pk.length <= 12) return pk;
    return `${pk.slice(0, 5)}…${pk.slice(-5)}`;
  }
}

function counted(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`
}

function contactsFileName(userName: string, day: Date): string {
  return ['contacts', ...wordsOf(userName), isoDay(day)].join('-') + '.json'
}

function wordsOf(text: string): string[] {
  return comparable(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
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
