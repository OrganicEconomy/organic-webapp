import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { decodeQr } from 'organic-protocol';

import { PayOffline } from './pay-offline';
import { ConnectedUserService } from '../../services/connected-user.service';
import { BackupService } from '../../services/backup.service';

const MY_PK = '02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3';
const CONTACT_PK = '0306ffd8f4fe843f5f7183179dcf36f550326813f56ec824911abca9c9d1cd7834';

let fakeTx: any;
let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordAutomatic'>>;

describe('PayOffline', () => {
  let component: PayOffline;
  let fixture: ComponentFixture<PayOffline>;

  beforeEach(() => {
    fakeTx = {
      target: CONTACT_PK,
      date: new Date(2026, 6, 22),
      money: [1, 2, 3],
      export: () => ({ v: 1, d: 20260722, t: 3, p: CONTACT_PK, s: MY_PK, m: '', i: '', h: 'deadbeef' }),
    };
    fakeBlockchain = {
      getMyPublicKey: () => MY_PK,
      getAvailableMoneyAmount: () => 100,
      pay: jasmine.createSpy('pay').and.returnValue(fakeTx),
    };
    fakeAccount = {
      contacts: [{ name: 'Bob', pk: CONTACT_PK }],
      serverUrl: 'https://trifouillis.fr',
      sentOfflineTx: [],
      blockchain: fakeBlockchain,
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => 'the-real-sk',
      isReadOnlySession: () => false,
    };
    backupSpy = jasmine.createSpyObj('BackupService', ['recordAutomatic']);

    TestBed.configureTestingModule({
      imports: [PayOffline],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: BackupService, useValue: backupSpy },
      ],
    });

    fixture = TestBed.createComponent(PayOffline);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call blockchain.pay with the target and amount from the form', () => {
    component.target = CONTACT_PK;
    component.amount = 5;
    component.validated = true;

    component.payOffline();

    expect(fakeBlockchain.pay).toHaveBeenCalledWith('the-real-sk', CONTACT_PK, 5);
  });

  it('should not pay when the target is missing, the amount is zero, or unconfirmed', () => {
    component.target = '';
    component.amount = 5;
    component.validated = true;
    component.payOffline();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();

    component.target = CONTACT_PK;
    component.amount = 0;
    component.payOffline();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();

    component.amount = 5;
    component.validated = false;
    component.payOffline();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should record the mutation (via backup.service) and add the tx to sentOfflineTx after paying', () => {
    component.target = CONTACT_PK;
    component.amount = 5;
    component.validated = true;

    component.payOffline();

    expect(backupSpy.recordAutomatic).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
    expect(fakeAccount.sentOfflineTx.length).toBe(1);
    expect(fakeAccount.sentOfflineTx[0].h).toBe('deadbeef');
  });

  it('should display a QR that decodes back to the paid transaction', () => {
    component.target = CONTACT_PK;
    component.amount = 5;
    component.validated = true;

    component.payOffline();

    expect(component.currentQr).not.toBeNull();
    const decoded = decodeQr(component.currentQr!);
    expect(decoded.type).toBe('TX');
    if (decoded.type === 'TX') {
      expect(decoded.payload.tx.h).toBe('deadbeef');
      expect(decoded.payload.url).toBe('https://trifouillis.fr');
    }
  });

  it('should not pay when the session is read-only', () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    component.target = CONTACT_PK;
    component.amount = 5;
    component.validated = true;

    component.payOffline();

    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('"revoir" should redisplay a past QR without calling pay() again', () => {
    fakeAccount.sentOfflineTx = [{ v: 1, d: 20260722, t: 3, p: CONTACT_PK, s: MY_PK, m: '', i: '', h: 'cafebabe' }];
    fixture = TestBed.createComponent(PayOffline);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.review(fakeAccount.sentOfflineTx[0]);

    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
    const decoded = decodeQr(component.currentQr!);
    if (decoded.type === 'TX') {
      expect(decoded.payload.tx.h).toBe('cafebabe');
    }
  });
});
