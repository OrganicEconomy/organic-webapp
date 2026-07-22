import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { encodeOfflineTxQr, encodeContactQr } from 'organic-protocol';

import { ReceiveOffline } from './receive-offline';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { BackupService } from '../../services/backup.service';

const MY_PK = '02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3';
const PAYER_PK = '0306ffd8f4fe843f5f7183179dcf36f550326813f56ec824911abca9c9d1cd7834';
const PAYER_URL = 'https://payer.fr';

function makePayTxWire(overrides: Partial<any> = {}): any {
  return {
    v: 1, d: 20260722, t: 3, p: MY_PK, s: PAYER_PK, m: '', i: '', h: 'deadbeef',
    ...overrides,
  };
}

let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'verifyTransaction'>>;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordAutomatic'>>;

describe('ReceiveOffline', () => {
  let component: ReceiveOffline;
  let fixture: ComponentFixture<ReceiveOffline>;

  beforeEach(() => {
    fakeBlockchain = {
      getMyPublicKey: () => MY_PK,
      receivePay: jasmine.createSpy('receivePay'),
    };
    fakeAccount = {
      contacts: [],
      serverUrl: 'https://trifouillis.fr',
      pendingOfflineTx: [],
      blockchain: fakeBlockchain,
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => 'the-real-sk',
      isReadOnlySession: () => false,
    };
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['verifyTransaction']);
    serverDBSpy.verifyTransaction.and.returnValue(of({ status: 'pending' }));
    backupSpy = jasmine.createSpyObj('BackupService', ['recordAutomatic']);

    TestBed.configureTestingModule({
      imports: [ReceiveOffline],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ServerConnexionService, useValue: serverDBSpy },
        { provide: BackupService, useValue: backupSpy },
      ],
    });

    fixture = TestBed.createComponent(ReceiveOffline);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reconstruct a valid TX QR and call receivePay with the instance', () => {
    const qr = encodeOfflineTxQr({ tx: makePayTxWire(), url: PAYER_URL });

    component.scanSuccessHandler(qr);

    expect(fakeBlockchain.receivePay).toHaveBeenCalledTimes(1);
    const receivedArg = fakeBlockchain.receivePay.calls.mostRecent().args[0];
    expect(receivedArg.signer).toBe(PAYER_PK);
  });

  it('should reject a QR of another type without crashing', () => {
    const qr = encodeContactQr({ pk: 'x', url: 'https://x.fr', n: 'X' });

    expect(() => component.scanSuccessHandler(qr)).not.toThrow();

    expect(fakeBlockchain.receivePay).not.toHaveBeenCalled();
    expect(component.scanError).toBeTruthy();
  });

  it('should reject an unreadable QR without crashing', () => {
    expect(() => component.scanSuccessHandler('not a qr at all')).not.toThrow();
    expect(component.scanError).toBeTruthy();
  });

  it('should push the tx (with its payer url) to pendingOfflineTx and record the mutation on a successful scan', () => {
    const qr = encodeOfflineTxQr({ tx: makePayTxWire(), url: PAYER_URL });

    component.scanSuccessHandler(qr);

    expect(fakeAccount.pendingOfflineTx.length).toBe(1);
    expect(fakeAccount.pendingOfflineTx[0].url).toBe(PAYER_URL);
    expect(fakeAccount.pendingOfflineTx[0].tx.h).toBe('deadbeef');
    expect(backupSpy.recordAutomatic).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
  });

  it('should not scan (or call receivePay) when the session is read-only', () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    const qr = encodeOfflineTxQr({ tx: makePayTxWire(), url: PAYER_URL });

    component.scanSuccessHandler(qr);

    expect(fakeBlockchain.receivePay).not.toHaveBeenCalled();
    expect(fakeAccount.pendingOfflineTx.length).toBe(0);
  });

  it('verifyAll() should call verifyTransaction for each pending entry using its own payer url', () => {
    fakeAccount.pendingOfflineTx = [{ tx: makePayTxWire(), url: PAYER_URL }];

    component.verifyAll();

    expect(serverDBSpy.verifyTransaction).toHaveBeenCalledWith(PAYER_URL, fakeAccount.pendingOfflineTx[0].tx);
  });

  it('should remove a confirmed tx from pendingOfflineTx', () => {
    fakeAccount.pendingOfflineTx = [{ tx: makePayTxWire(), url: PAYER_URL }];
    serverDBSpy.verifyTransaction.and.returnValue(of({ status: 'confirmed' }));

    component.verifyAll();

    expect(fakeAccount.pendingOfflineTx.length).toBe(0);
  });

  it('should keep an invalid tx visible with a flagged status, not remove it', () => {
    fakeAccount.pendingOfflineTx = [{ tx: makePayTxWire(), url: PAYER_URL }];
    serverDBSpy.verifyTransaction.and.returnValue(of({ status: 'invalid' }));

    component.verifyAll();

    expect(fakeAccount.pendingOfflineTx.length).toBe(1);
    expect(component.displayRows[0].status).toBe('invalid');
  });

  it('dismiss() should remove a flagged entry and persist the removal', () => {
    fakeAccount.pendingOfflineTx = [{ tx: makePayTxWire(), url: PAYER_URL }];
    serverDBSpy.verifyTransaction.and.returnValue(of({ status: 'invalid' }));
    component.verifyAll();

    component.dismiss('deadbeef');

    expect(fakeAccount.pendingOfflineTx.length).toBe(0);
    expect(backupSpy.recordAutomatic).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
  });

  it('should not re-verify an entry already flagged invalid', () => {
    fakeAccount.pendingOfflineTx = [{ tx: makePayTxWire(), url: PAYER_URL }];
    serverDBSpy.verifyTransaction.and.returnValue(of({ status: 'invalid' }));
    component.verifyAll();
    serverDBSpy.verifyTransaction.calls.reset();

    component.verifyAll();

    expect(serverDBSpy.verifyTransaction).not.toHaveBeenCalled();
  });
});
