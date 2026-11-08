import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { ContactCheckService } from './contact-check.service';
import { ServerConnexionService } from './server-connection.service';
import type { Contact } from '../models/account';
import { MALFORMED_PUBLIC_KEY_MESSAGE } from '../utils/public-key.util';

const basilePk = '02' + 'b5'.repeat(32);

function contact(fields: Partial<Contact> = {}): Contact {
  return { name: 'Basile', pk: basilePk, url: 'https://trifouillis.fr', type: 'citizen', ...fields };
}

describe('ContactCheckService', () => {
  let service: ContactCheckService;
  let serverSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'getValidationStatus' | 'getEcosystemInfo'>>;
  let user: { contacts: Contact[]; serverUrl: string };

  beforeEach(() => {
    serverSpy = jasmine.createSpyObj('ServerConnexionService', ['getValidationStatus', 'getEcosystemInfo']);
    serverSpy.getValidationStatus.and.returnValue(of({ status: 'active' }));
    serverSpy.getEcosystemInfo.and.returnValue(of({ blocks: [] } as any));
    user = { contacts: [], serverUrl: 'https://mon-serveur.fr' };
    TestBed.configureTestingModule({
      providers: [{ provide: ServerConnexionService, useValue: serverSpy }],
    });
    service = TestBed.inject(ContactCheckService);
  });

  describe('refusal', () => {
    it('should refuse a contact without a name', async () => {
      expect(await service.refusal(contact({ name: '' }), user)).toBe('Le nom du contact est obligatoire.');
    });

    it('should refuse a malformed public key', async () => {
      expect(await service.refusal(contact({ pk: 'abcdef123456' }), user)).toBe(MALFORMED_PUBLIC_KEY_MESSAGE);
    });

    it('should refuse a key already among the contacts, naming that contact', async () => {
      user.contacts = [contact({ name: 'Basile' })];

      expect(await service.refusal(contact({ name: 'Basile bis' }), user)).toBe(
        'Cette clé est déjà dans vos contacts, sous le nom Basile.',
      );
    });

    it('should refuse a citizen key unknown to the contact server', async () => {
      serverSpy.getValidationStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

      expect(await service.refusal(contact(), user)).toBe("Aucun citoyen n'a cette clé sur ce serveur.");
      expect(serverSpy.getValidationStatus).toHaveBeenCalledWith('https://trifouillis.fr', basilePk);
    });

    it('should refuse an ecosystem key unknown to the contact server', async () => {
      serverSpy.getEcosystemInfo.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

      expect(await service.refusal(contact({ type: 'ecosystem' }), user)).toBe(
        "Aucun écosystème n'a cette clé sur ce serveur.",
      );
      expect(serverSpy.getEcosystemInfo).toHaveBeenCalledWith('https://trifouillis.fr', basilePk);
    });

    it('should refuse a contact that could not be checked because the server is unreachable', async () => {
      serverSpy.getValidationStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

      expect(await service.refusal(contact(), user)).toBe(
        'Impossible de vérifier ce contact : pas de connexion au serveur.',
      );
    });

    it('should refuse a contact that could not be checked because the server answers wrongly', async () => {
      serverSpy.getValidationStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      expect(await service.refusal(contact(), user)).toBe(
        'Impossible de vérifier ce contact : le serveur ne répond pas correctement.',
      );
    });

    it('should accept a well-formed new contact known to its server', async () => {
      expect(await service.refusal(contact(), user)).toBeNull();
    });

    it('should check a contact without a server on my own server', async () => {
      await service.refusal(contact({ url: '' }), user);

      expect(serverSpy.getValidationStatus).toHaveBeenCalledWith('https://mon-serveur.fr', basilePk);
    });
  });
});
