import type { Contact } from '../models/account';
import { ContactsFileError, contactsFile, contactsFromFile } from './contacts-file.util';

describe('contactsFile', () => {
  it('should list every contact with its name, key, server and type', () => {
    const contacts = [
      { name: 'Zoé', pk: 'pk-zoe', url: 'https://trifouillis.fr', type: 'citizen' as const },
      {
        name: 'La Boulange',
        pk: 'pk-boulange',
        url: 'https://trifouillis.fr',
        type: 'ecosystem' as const,
      },
    ];

    expect(JSON.parse(contactsFile(contacts))).toEqual({
      format: 'organic-contacts',
      version: 1,
      contacts,
    });
  });

  it('should leave out any other field of the contacts', () => {
    const contact = {
      name: 'Zoé',
      pk: 'pk-zoe',
      url: 'https://trifouillis.fr',
      type: 'citizen',
      balance: 3,
    };

    expect(JSON.parse(contactsFile([contact as Contact])).contacts[0].balance).toBeUndefined();
  });
});

describe('contactsFromFile', () => {
  const NOT_A_CONTACTS_FILE = "Ce fichier n'est pas un fichier de contacts.";
  const zoe: Contact = {
    name: 'Zoé',
    pk: 'pk-zoe',
    url: 'https://trifouillis.fr',
    type: 'citizen',
  };

  function fileWith(fields: object): string {
    return JSON.stringify({ format: 'organic-contacts', version: 1, contacts: [zoe], ...fields });
  }

  it('should read back the contacts written by contactsFile', () => {
    expect(contactsFromFile(contactsFile([zoe]))).toEqual([zoe]);
  });

  it('should leave out any other field of the contacts', () => {
    expect(contactsFromFile(fileWith({ contacts: [{ ...zoe, balance: 3 }] }))).toEqual([zoe]);
  });

  it('should trim the spaces around the names, as the contact form does', () => {
    expect(contactsFromFile(fileWith({ contacts: [{ ...zoe, name: '  Zoé ' }] }))).toEqual([zoe]);
  });

  it('should reject a text that is not JSON', () => {
    expect(() => contactsFromFile('pas du JSON')).toThrowError(
      ContactsFileError,
      NOT_A_CONTACTS_FILE,
    );
  });

  it('should reject a JSON file that is not a contacts file', () => {
    expect(() => contactsFromFile('{"contacts": []}')).toThrowError(
      ContactsFileError,
      NOT_A_CONTACTS_FILE,
    );
  });

  it('should reject a file with an incomplete contact, saying which one', () => {
    const { url, ...zoeWithoutServer } = zoe;

    expect(() => contactsFromFile(fileWith({ contacts: [zoe, zoeWithoutServer] }))).toThrowError(
      ContactsFileError,
      'Ce fichier de contacts est abîmé : le contact n° 2 est illisible.',
    );
  });

  it('should reject a file written by a newer version of the app', () => {
    expect(() => contactsFromFile(fileWith({ version: 2 }))).toThrowError(
      ContactsFileError,
      "Ce fichier de contacts vient d'une version plus récente de l'application : mettez-la à jour.",
    );
  });

  it('should reject a file with a contact of an unknown type', () => {
    expect(() =>
      contactsFromFile(fileWith({ contacts: [{ ...zoe, type: 'martian' }] })),
    ).toThrowError(
      ContactsFileError,
      'Ce fichier de contacts est abîmé : le contact n° 1 est illisible.',
    );
  });

  it('should reject a file without a version', () => {
    expect(() => contactsFromFile(fileWith({ version: undefined }))).toThrowError(
      ContactsFileError,
      NOT_A_CONTACTS_FILE,
    );
  });
});
