import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { encodeContactQr, encodePaperQr } from 'organic-protocol';

import { AddContact } from './add-contact';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ServerConnexionService } from '../../services/server-connection.service';

const basilePk = '02' + 'b5'.repeat(32);

let fakeAccount: any;
let stubConnectedUserService: any;
let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
let linkParams: Record<string, string>;
let serverSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'getValidationStatus' | 'getEcosystemInfo' | 'getKnownServers'>>;

describe('AddContact', () => {
  let component: AddContact;
  let fixture: ComponentFixture<AddContact>;

  beforeEach(() => {
    fakeAccount = { contacts: [], serverUrl: 'https://mon-serveur.fr' };
    linkParams = {};
    stubConnectedUserService = { getConnectedUser: () => fakeAccount, getSecretKey: () => '' };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    serverSpy = jasmine.createSpyObj('ServerConnexionService', ['getValidationStatus', 'getEcosystemInfo', 'getKnownServers']);
    serverSpy.getKnownServers.and.returnValue(of([]));
    serverSpy.getValidationStatus.and.returnValue(of({ status: 'active' }));
    serverSpy.getEcosystemInfo.and.returnValue(of({ blocks: [] } as any));

    TestBed.configureTestingModule({
      imports: [AddContact],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: ServerConnexionService, useValue: serverSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParams() { return linkParams; },
              get queryParamMap() { return convertToParamMap(linkParams); },
            },
          },
        },
      ],
    });

    createComponent();
  });

  function createComponent() {
    fixture = TestBed.createComponent(AddContact);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should prefill the form from a scanned OM1:CT QR', () => {
    const qr = encodeContactQr({ pk: 'scanned-pk', url: 'https://trifouillis.fr', n: 'Alice' });

    component.scanSuccessHandler(qr);

    expect(component.addcontactForm.value.name).toBe('Alice');
    expect(component.addcontactForm.value.pk).toBe('scanned-pk');
    expect(component.addcontactForm.value.url).toBe('https://trifouillis.fr');
  });

  it('should clear a previous form error once a scanned contact QR fills the form', async () => {
    component.addcontactForm.setValue({ name: 'Basile', pk: 'abcdef123456', url: '' });
    await component.addContact();

    component.scanSuccessHandler(encodeContactQr({ pk: basilePk, url: 'https://trifouillis.fr', n: 'Basile' }));

    expect(component.formError).toBe('');
  });

  it('should show an error for a QR of another type, without crashing', () => {
    const paperQr = encodePaperQr({
      tx: { v: 1, d: 20260722, t: 5, p: 'referent-pk', s: 'signer-pk', m: '', i: '', h: 'sig' },
    });

    expect(() => component.scanSuccessHandler(paperQr)).not.toThrow();

    expect(component.scanError).toBeTruthy();
  });

  it('should show an error for text that is not an OM QR at all, without crashing', () => {
    expect(() => component.scanSuccessHandler('not a qr at all')).not.toThrow();

    expect(component.scanError).toBeTruthy();
  });

  it('should add a well-formed Contact (4 fields) from manual entry', async () => {
    component.addcontactForm.setValue({ name: 'Basile', pk: basilePk, url: 'https://trifouillis.fr' });

    await component.addContact();

    expect(fakeAccount.contacts).toEqual([
      { name: 'Basile', pk: basilePk, url: 'https://trifouillis.fr', type: 'citizen' },
    ]);
    expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeAccount);
  });

  it('should add a contact whose pasted key has surrounding spaces', async () => {
    component.addcontactForm.setValue({ name: 'Basile', pk: `  ${basilePk} `, url: 'https://trifouillis.fr' });

    await component.addContact();

    expect(fakeAccount.contacts).toEqual([
      { name: 'Basile', pk: basilePk, url: 'https://trifouillis.fr', type: 'citizen' },
    ]);
  });

  it('should refuse to add a contact without a name', async () => {
    component.addcontactForm.setValue({ name: '  ', pk: basilePk, url: 'https://trifouillis.fr' });

    await component.addContact();

    expect(fakeAccount.contacts).toEqual([]);
    expect(component.formError).toBe('Le nom du contact est obligatoire.');
  });

  it('should refuse to add a key already among the contacts', async () => {
    const basile = { name: 'Basile', pk: basilePk, url: 'https://trifouillis.fr', type: 'citizen' };
    fakeAccount.contacts = [basile];
    component.addcontactForm.setValue({ name: 'Basile bis', pk: basilePk, url: 'https://trifouillis.fr' });

    await component.addContact();

    expect(fakeAccount.contacts).toEqual([basile]);
    expect(component.formError).toBe('Cette clé est déjà dans vos contacts, sous le nom Basile.');
  });

  it('should refuse a citizen key unknown to the contact server', async () => {
    serverSpy.getValidationStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    component.addcontactForm.setValue({ name: 'Basile', pk: basilePk, url: 'https://trifouillis.fr' });

    await component.addContact();

    expect(serverSpy.getValidationStatus).toHaveBeenCalledWith('https://trifouillis.fr', basilePk);
    expect(fakeAccount.contacts).toEqual([]);
    expect(component.formError).toBe("Aucun citoyen n'a cette clé sur ce serveur.");
  });

  it('should refuse a scanned ecosystem key unknown to the contact server', async () => {
    serverSpy.getEcosystemInfo.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    component.scanSuccessHandler(encodeContactQr({ pk: basilePk, url: 'https://trifouillis.fr', n: 'Boulangerie', e: true }));

    await component.addContact();

    expect(serverSpy.getEcosystemInfo).toHaveBeenCalledWith('https://trifouillis.fr', basilePk);
    expect(fakeAccount.contacts).toEqual([]);
    expect(component.formError).toBe("Aucun écosystème n'a cette clé sur ce serveur.");
  });

  it('should not add a contact that could not be checked because the server is unreachable', async () => {
    serverSpy.getValidationStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.addcontactForm.setValue({ name: 'Basile', pk: basilePk, url: 'https://trifouillis.fr' });

    await component.addContact();

    expect(fakeAccount.contacts).toEqual([]);
    expect(component.formError).toBe('Impossible de vérifier ce contact : pas de connexion au serveur.');
  });

  it('should refuse to add a contact whose public key is malformed', async () => {
    component.addcontactForm.setValue({ name: 'Basile', pk: 'abcdef123456', url: 'https://trifouillis.fr' });

    await component.addContact();

    expect(fakeAccount.contacts).toEqual([]);
    expect(localDBSpy.saveUser).not.toHaveBeenCalled();
    expect(component.formError).toBe(
      "Cette clé publique n'est pas valide : elle doit faire 66 caractères (0-9, a-f) et commencer par 02 ou 03.",
    );
  });

  describe('scanSuccessHandler', () => {
    it('should close the scanner once a contact card is recognized', () => {
      component.scanSuccessHandler(encodeContactQr({ pk: basilePk, url: 'https://trifouillis.fr', n: 'Basile' }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-qr-scanner')).toBeNull();
    });

    it('should confirm the recognized contact by name', () => {
      component.scanSuccessHandler(encodeContactQr({ pk: basilePk, url: 'https://trifouillis.fr', n: 'Basile' }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.scan-success').textContent).toContain('Contact reconnu : Basile');
    });

    it('should keep the scanner open for a QR that is not a contact card', () => {
      component.scanSuccessHandler('not a qr at all');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-qr-scanner')).not.toBeNull();
    });
  });

  describe('scanAgain', () => {
    it('should reopen the scanner', () => {
      component.scanSuccessHandler(encodeContactQr({ pk: basilePk, url: 'https://trifouillis.fr', n: 'Basile' }));
      fixture.detectChanges();

      component.scanAgain();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-qr-scanner')).not.toBeNull();
    });
  });

  describe('constructor', () => {
    it('should send a visitor with no open account to the account choice, keeping the shared link', () => {
      fakeAccount = null;
      linkParams = { pk: basilePk, server: 'https://trifouillis.fr', name: 'Basile' };
      const navigate = spyOn(TestBed.inject(Router), 'navigate');

      createComponent();

      expect(navigate).toHaveBeenCalledWith(['/user-selection'], {
        queryParams: { next: `/addcontact?pk=${basilePk}&server=https:%2F%2Ftrifouillis.fr&name=Basile` },
      });
    });
  });

  describe('ngOnInit', () => {
    it('should prefill the server with my own server when no link was shared', () => {
      expect(component.addcontactForm.value.url).toBe('https://mon-serveur.fr');
    });

    it('should offer the servers known to my own server', () => {
      const servers = [{ name: 'Trifouillis', url: 'https://trifouillis.fr' }];
      serverSpy.getKnownServers.and.returnValue(of(servers));

      createComponent();

      expect(serverSpy.getKnownServers).toHaveBeenCalledWith('https://mon-serveur.fr');
      expect(component.knownServers).toEqual(servers);
    });

    it('should prefill the form from a shared contact link', () => {
      linkParams = { pk: basilePk, server: 'https://trifouillis.fr', name: 'Basile' };

      createComponent();

      expect(component.addcontactForm.value).toEqual({ name: 'Basile', pk: basilePk, url: 'https://trifouillis.fr' });
    });
  });
});
