import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { encodeContactQr, encodePaperQr } from 'organic-protocol';

import { AddContact } from './add-contact';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';

let fakeAccount: any;
let stubConnectedUserService: any;
let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;

describe('AddContact', () => {
  let component: AddContact;
  let fixture: ComponentFixture<AddContact>;

  beforeEach(() => {
    fakeAccount = { contacts: [] };
    stubConnectedUserService = { getConnectedUser: () => fakeAccount, getSecretKey: () => '' };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);

    TestBed.configureTestingModule({
      imports: [AddContact],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: LocalDatabaseService, useValue: localDBSpy },
      ],
    });

    fixture = TestBed.createComponent(AddContact);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

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
    component.addcontactForm.setValue({ name: 'Basile', pk: 'basile-pk', url: 'https://trifouillis.fr' });

    await component.addContact();

    expect(fakeAccount.contacts).toEqual([
      { name: 'Basile', pk: 'basile-pk', url: 'https://trifouillis.fr', type: 'citizen' },
    ]);
    expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeAccount);
  });
});
