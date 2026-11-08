import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, map, of } from 'rxjs';
import type { Contact } from '../models/account';
import { ServerConnexionService } from './server-connection.service';
import { lookupFailure } from '../utils/lookup-failure.util';
import { MALFORMED_PUBLIC_KEY_MESSAGE, isWellFormedPublicKey } from '../utils/public-key.util';

export interface ContactOwner {
  contacts: Contact[]
  serverUrl: string
}

@Injectable({ providedIn: 'root' })
export class ContactCheckService {
  private server = inject(ServerConnexionService)

  async refusal(contact: Contact, owner: ContactOwner): Promise<string | null> {
    return formRefusal(contact, owner.contacts) ?? await this.serverRefusal(contact, owner.serverUrl)
  }

  private serverRefusal(contact: Contact, ownServerUrl: string): Promise<string | null> {
    return firstValueFrom(
      this.lookUp(contact, contact.url || ownServerUrl).pipe(
        map(() => null),
        catchError((error) => of(lookupRefusal(error, contact))),
      ),
    )
  }

  private lookUp(contact: Contact, serverUrl: string): Observable<unknown> {
    return contact.type === 'ecosystem'
      ? this.server.getEcosystemInfo(serverUrl, contact.pk)
      : this.server.getValidationStatus(serverUrl, contact.pk)
  }
}

function formRefusal(contact: Contact, contacts: Contact[]): string | null {
  if (!contact.name) {
    return 'Le nom du contact est obligatoire.'
  }
  if (!isWellFormedPublicKey(contact.pk)) {
    return MALFORMED_PUBLIC_KEY_MESSAGE
  }
  const existing = contactWithKey(contact.pk, contacts)
  if (existing) {
    return `Cette clé est déjà dans vos contacts, sous le nom ${existing.name}.`
  }
  return null
}

function lookupRefusal(error: HttpErrorResponse, contact: Contact): string {
  switch (lookupFailure(error)) {
    case 'unknown':
      return contact.type === 'ecosystem'
        ? "Aucun écosystème n'a cette clé sur ce serveur."
        : "Aucun citoyen n'a cette clé sur ce serveur."
    case 'unreachable':
      return 'Impossible de vérifier ce contact : pas de connexion au serveur.'
    case 'server-error':
      return 'Impossible de vérifier ce contact : le serveur ne répond pas correctement.'
  }
}

export function contactWithKey(pk: string, contacts: Contact[]): Contact | undefined {
  return contacts.find((contact) => contact.pk === pk)
}
