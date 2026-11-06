import { contactsFile } from './contacts-file.util';

describe('contactsFile', () => {
  it('should list every contact with its name, key, server and type', () => {
    const contacts = [
      { name: 'Zoé', pk: 'pk-zoe', url: 'https://trifouillis.fr', type: 'citizen' as const },
      { name: 'La Boulange', pk: 'pk-boulange', url: 'https://trifouillis.fr', type: 'ecosystem' as const },
    ];

    expect(JSON.parse(contactsFile(contacts))).toEqual({
      format: 'organic-contacts',
      version: 1,
      contacts,
    });
  });
});
