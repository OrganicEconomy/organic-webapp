import type { Contact, ContactType } from '../models/account';

const CONTACTS_FILE_FORMAT = 'organic-contacts';
const CONTACTS_FILE_VERSION = 1;
const CONTACT_TYPES: ContactType[] = ['citizen', 'ecosystem'];
const NOT_A_CONTACTS_FILE = "Ce fichier n'est pas un fichier de contacts.";

function onlyContactFields({ name, pk, url, type }: Contact): Contact {
  return { name, pk, url, type };
}

export function contactsFile(contacts: Contact[]): string {
  return JSON.stringify({
    format: CONTACTS_FILE_FORMAT,
    version: CONTACTS_FILE_VERSION,
    contacts: contacts.map(onlyContactFields),
  });
}

export class ContactsFileError extends Error {}

function parsedJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    throw new ContactsFileError(NOT_A_CONTACTS_FILE);
  }
}

function isContactsFile(file: any): boolean {
  return (
    file?.format === CONTACTS_FILE_FORMAT &&
    Number.isInteger(file.version) &&
    Array.isArray(file.contacts)
  );
}

function isWrittenByNewerVersion(file: any): boolean {
  return file.version > CONTACTS_FILE_VERSION;
}

function isContact(contact: any): contact is Contact {
  return (
    ['name', 'pk', 'url'].every((field) => typeof contact?.[field] === 'string') &&
    CONTACT_TYPES.includes(contact.type)
  );
}

function assertIsReadable(contact: any, index: number): void {
  if (!isContact(contact)) {
    throw new ContactsFileError(
      `Ce fichier de contacts est abîmé : le contact n° ${index + 1} est illisible.`,
    );
  }
}

function withTrimmedName(contact: Contact): Contact {
  return { ...contact, name: contact.name.trim() };
}

export function contactsFromFile(text: string): Contact[] {
  const file = parsedJson(text);
  if (!isContactsFile(file)) {
    throw new ContactsFileError(NOT_A_CONTACTS_FILE);
  }
  if (isWrittenByNewerVersion(file)) {
    throw new ContactsFileError(
      "Ce fichier de contacts vient d'une version plus récente de l'application : mettez-la à jour.",
    );
  }
  file.contacts.forEach(assertIsReadable);
  return file.contacts.map(onlyContactFields).map(withTrimmedName);
}
