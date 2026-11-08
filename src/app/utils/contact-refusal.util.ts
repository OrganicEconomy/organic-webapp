import type { Contact } from '../models/account';
import { MALFORMED_PUBLIC_KEY_MESSAGE, isWellFormedPublicKey } from './public-key.util';

function contactWithKey(pk: string, contacts: Contact[]): Contact | undefined {
  return contacts.find((contact) => contact.pk === pk);
}

export function hasContactWithKey(pk: string, contacts: Contact[]): boolean {
  return contactWithKey(pk, contacts) !== undefined;
}

export function localRefusal(contact: Contact, contacts: Contact[]): string | null {
  if (!contact.name) {
    return 'Le nom du contact est obligatoire.';
  }
  if (!isWellFormedPublicKey(contact.pk)) {
    return MALFORMED_PUBLIC_KEY_MESSAGE;
  }
  const existing = contactWithKey(contact.pk, contacts);
  if (existing) {
    return `Cette clé est déjà dans vos contacts, sous le nom ${existing.name}.`;
  }
  return null;
}
