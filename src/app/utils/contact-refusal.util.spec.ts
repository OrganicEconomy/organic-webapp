import type { Contact } from '../models/account';
import { localRefusal } from './contact-refusal.util';
import { MALFORMED_PUBLIC_KEY_MESSAGE } from './public-key.util';

const basilePk = '02' + 'b5'.repeat(32);

function contact(fields: Partial<Contact> = {}): Contact {
  return {
    name: 'Basile',
    pk: basilePk,
    url: 'https://trifouillis.fr',
    type: 'citizen',
    ...fields,
  };
}

describe('localRefusal', () => {
  it('should refuse a contact without a name', () => {
    expect(localRefusal(contact({ name: '' }), [])).toBe('Le nom du contact est obligatoire.');
  });

  it('should refuse a malformed public key', () => {
    expect(localRefusal(contact({ pk: 'abcdef123456' }), [])).toBe(MALFORMED_PUBLIC_KEY_MESSAGE);
  });

  it('should refuse a key already among the contacts, naming that contact', () => {
    expect(localRefusal(contact({ name: 'Basile bis' }), [contact()])).toBe(
      'Cette clé est déjà dans vos contacts, sous le nom Basile.',
    );
  });

  it('should accept a well-formed new contact', () => {
    expect(localRefusal(contact(), [])).toBeNull();
  });
});
