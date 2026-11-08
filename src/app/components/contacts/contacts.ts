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
import { ContactCheckService, contactWithKey } from '../../services/contact-check.service';
import type { Contact } from '../../models/account';
import { ContactsFileError, contactsFile, contactsFromFile } from '../../utils/contacts-file.util';
import { offerToDownload } from '../../utils/download.util';

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
  contactCheck = inject(ContactCheckService)
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
    offerToDownload(contactsFile(this.user.contacts), contactsFileName(this.user.name, new Date()), 'application/json')
  }

  importReport = signal<ImportReport | null>(null)
  importError = signal('')
  importing = signal(false)
  importSummary = computed(() => {
    const report = this.importReport()
    return report ? summaryOf(report) : ''
  })

  private async readContactsFile(file: File): Promise<Contact[] | null> {
    try {
      return contactsFromFile(await file.text())
    } catch (error) {
      if (error instanceof ContactsFileError) {
        this.importError.set(error.message)
        return null
      }
      throw error
    }
  }

  private isAlreadyKnown(contact: Contact, knownContacts: Contact[]): boolean {
    return contact.pk === this.user.publickey || contactWithKey(contact.pk, knownContacts) !== undefined
  }

  private async sortOut(contacts: Contact[]): Promise<{ accepted: Contact[], report: ImportReport }> {
    const accepted: Contact[] = []
    const report: ImportReport = { added: 0, alreadyKnown: 0, refused: [] }
    for (const contact of contacts) {
      const knownContacts = [...this.user.contacts, ...accepted]
      if (this.isAlreadyKnown(contact, knownContacts)) {
        report.alreadyKnown++
        continue
      }
      const refusal = await this.contactCheck.refusal(contact, { contacts: knownContacts, serverUrl: this.user.serverUrl })
      if (refusal) {
        report.refused.push({ name: contact.name, reason: refusal })
        continue
      }
      accepted.push(contact)
    }
    report.added = accepted.length
    return { accepted, report }
  }

  private async isSavedWith(accepted: Contact[]): Promise<boolean> {
    const previousContacts = this.user.contacts
    this.user.contacts = [...previousContacts, ...accepted]
    try {
      await this.localDB.saveUser(this.user)
      this.contacts.set(this.user.contacts)
      return true
    } catch (error) {
      console.error(error)
      this.user.contacts = previousContacts
      this.importError.set("Les contacts n'ont pas pu être enregistrés sur cet appareil : rien n'a été importé.")
      return false
    }
  }

  private async importContactsOf(file: File): Promise<void> {
    this.importError.set('')
    this.importReport.set(null)
    const contacts = await this.readContactsFile(file)
    if (contacts === null) {
      return
    }
    const { accepted, report } = await this.sortOut(contacts)
    if (accepted.length > 0 && !(await this.isSavedWith(accepted))) {
      return
    }
    this.importReport.set(report)
  }

  async importContacts(file: File): Promise<void> {
    this.importing.set(true)
    try {
      await this.importContactsOf(file)
    } finally {
      this.importing.set(false)
    }
  }

  async importChosenFile(filePicker: HTMLInputElement): Promise<void> {
    const file = filePicker.files?.[0]
    filePicker.value = ''
    if (file) {
      await this.importContacts(file)
    }
  }

  truncate(pk: string): string {
    if (!pk || pk.length <= 12) return pk;
    return `${pk.slice(0, 5)}…${pk.slice(-5)}`;
  }
}

function counted(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`
}

function summaryOf(report: ImportReport): string {
  const parts = [counted(report.added, 'contact ajouté', 'contacts ajoutés')]
  if (report.alreadyKnown > 0) {
    parts.push(counted(report.alreadyKnown, 'déjà présent', 'déjà présents'))
  }
  return parts.join(', ') + '.'
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
