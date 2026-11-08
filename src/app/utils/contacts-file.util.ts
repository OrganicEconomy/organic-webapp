import type { Contact } from '../models/account';

const CONTACTS_FILE_FORMAT = 'organic-contacts';
const CONTACTS_FILE_VERSION = 1;

export function contactsFile(contacts: Contact[]): string {
  return JSON.stringify({
    format: CONTACTS_FILE_FORMAT,
    version: CONTACTS_FILE_VERSION,
    contacts: contacts.map(({ name, pk, url, type }) => ({ name, pk, url, type })),
  });
}
