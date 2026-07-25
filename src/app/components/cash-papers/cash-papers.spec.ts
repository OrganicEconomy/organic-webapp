import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { encodePaperQr, encodeContactQr } from 'organic-protocol';

import { CashPapers } from './cash-papers';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LevelUpService } from '../../services/level-up.service';
import { BackupService } from '../../services/backup.service';

const MY_PK = '02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3';
const REFERENT_PK = '0306ffd8f4fe843f5f7183179dcf36f550326813f56ec824911abca9c9d1cd7834';
const ISSUER_PK = '03aa11ff8f4fe843f5f7183179dcf36f550326813f56ec824911abca9c9d1c1234';

// A structurally well-formed PAPER TxWire — enough for TransactionMaker.make()
// to construct a real PaperTransaction instance. Not cryptographically signed:
// fine for display/reconstruction tests, which never call .isValid().
function makePaperTxWire(overrides: Partial<any> = {}): any {
  return {
    v: 1, d: 20260722, t: 5, p: REFERENT_PK, s: ISSUER_PK, m: '', i: '', h: 'deadbeef',
    ...overrides,
  };
}

let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'cashPaper' | 'isPaperAlreadyCashed' | 'signLastBlock'>>;
let levelUpSpy: jasmine.SpyObj<Pick<LevelUpService, 'celebrateIfLevelUp'>>;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordAutomatic'>>;

describe('CashPapers', () => {
  let component: CashPapers;
  let fixture: ComponentFixture<CashPapers>;

  beforeEach(async () => {
    fakeBlockchain = {
      getMyPublicKey: () => MY_PK,
      cashPaper: jasmine.createSpy('cashPaper'),
      getLevel: () => 2,
    };
    fakeAccount = {
      serverUrl: 'https://trifouillis.fr',
      contacts: [],
      blockchain: fakeBlockchain,
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => 'the-real-sk',
      isReadOnlySession: () => false,
    };
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['cashPaper', 'isPaperAlreadyCashed', 'signLastBlock']);
    serverDBSpy.isPaperAlreadyCashed.and.returnValue(throwError(() => ({ status: 404 })));
    serverDBSpy.cashPaper.and.returnValue(of({}));
    serverDBSpy.signLastBlock.and.returnValue(of({}));
    levelUpSpy = jasmine.createSpyObj('LevelUpService', ['celebrateIfLevelUp']);
    backupSpy = jasmine.createSpyObj('BackupService', ['recordAutomatic']);

    await TestBed.configureTestingModule({
      imports: [CashPapers],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ServerConnexionService, useValue: serverDBSpy },
        { provide: LevelUpService, useValue: levelUpSpy },
        { provide: BackupService, useValue: backupSpy },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CashPapers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should decode a valid PP QR, reconstruct it, and check with the server before accepting', () => {
    const qr = encodePaperQr({ tx: makePaperTxWire() });

    component.scanSuccessHandler(qr);

    expect(serverDBSpy.isPaperAlreadyCashed).toHaveBeenCalledWith('https://trifouillis.fr', 'deadbeef');
    expect(component.paper_list.length).toBe(1);
    expect(component.paper_list[0].signature).toBe('deadbeef');
  });

  it('should reject a QR of another type without crashing', () => {
    const qr = encodeContactQr({ pk: 'x', url: 'https://x.fr', n: 'X' });

    expect(() => component.scanSuccessHandler(qr)).not.toThrow();

    expect(component.paper_list.length).toBe(0);
  });

  it('should reject an unreadable QR without crashing', () => {
    expect(() => component.scanSuccessHandler('not a qr at all')).not.toThrow();

    expect(component.paper_list.length).toBe(0);
  });

  it('should not accept a paper already reported as cashed by the server', () => {
    serverDBSpy.isPaperAlreadyCashed.and.returnValue(of({ id: 1 }));
    const qr = encodePaperQr({ tx: makePaperTxWire() });

    component.scanSuccessHandler(qr);

    expect(component.paper_list.length).toBe(0);
  });

  it('should not scan the same paper twice', () => {
    const qr = encodePaperQr({ tx: makePaperTxWire() });

    component.scanSuccessHandler(qr);
    component.scanSuccessHandler(qr);

    expect(component.paper_list.length).toBe(1);
    expect(serverDBSpy.isPaperAlreadyCashed).toHaveBeenCalledTimes(1);
  });

  it('cashPapers() should call blockchain.cashPaper with the reconstructed instance, not a plain object', () => {
    const qr = encodePaperQr({ tx: makePaperTxWire() });
    component.scanSuccessHandler(qr);

    component.cashPapers();

    expect(fakeBlockchain.cashPaper).toHaveBeenCalledTimes(1);
    const receivedArg = fakeBlockchain.cashPaper.calls.mostRecent().args[0];
    expect(receivedArg.signer).toBe(ISSUER_PK); // decoded property, not the wire's "s" letter
  });

  it('cashPapers() should register the paper server-side and ask for the referent signature after a successful cash-in', () => {
    const qr = encodePaperQr({ tx: makePaperTxWire() });
    component.scanSuccessHandler(qr);

    component.cashPapers();

    expect(serverDBSpy.cashPaper).toHaveBeenCalledTimes(1);
    expect(serverDBSpy.signLastBlock).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
  });

  it('cashPapers() should record the mutation (via backup.service)', () => {
    const qr = encodePaperQr({ tx: makePaperTxWire() });
    component.scanSuccessHandler(qr);

    component.cashPapers();

    expect(backupSpy.recordAutomatic).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
  });

  it('cashPapers() should not call anything when the session is read-only', () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    const qr = encodePaperQr({ tx: makePaperTxWire() });
    component.scanSuccessHandler(qr);

    component.cashPapers();

    expect(fakeBlockchain.cashPaper).not.toHaveBeenCalled();
    expect(serverDBSpy.signLastBlock).not.toHaveBeenCalled();
  });

  it('should ask LevelUpService to celebrate using the level captured before and after cashing the batch', () => {
    fakeBlockchain.getLevel = jasmine.createSpy('getLevel').and.returnValues(2, 3);
    const qr = encodePaperQr({ tx: makePaperTxWire() });
    component.scanSuccessHandler(qr);

    component.cashPapers();

    expect(levelUpSpy.celebrateIfLevelUp).toHaveBeenCalledWith(2, 3);
  });

  it('getContactName should read from the contact list keyed by pk (used with tx.signer, not the nonexistent tx.source)', () => {
    fakeAccount.contacts = [{ pk: ISSUER_PK, name: 'Alice' }];
    expect(component.getContactName(ISSUER_PK)).toBe('Alice');
  });
});
