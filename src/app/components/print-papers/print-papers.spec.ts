import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';
import { decodeQr } from 'organic-protocol';
import { TransactionMaker } from 'organic-money/src/index.js';

import { PrintPapers } from './print-papers';
import { ConnectedUserService } from '../../services/connected-user.service';
import { BackupService } from '../../services/backup.service';

const MY_PK = '02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3';
const REFERENT_PK = '0306ffd8f4fe843f5f7183179dcf36f550326813f56ec824911abca9c9d1cd7834';

// A structurally well-formed PAPER TxWire — enough for TransactionMaker.make()
// to construct a real PaperTransaction instance with a real .export().
function makePaperTxWire(overrides: Partial<any> = {}): any {
  return {
    v: 1, d: 20260722, t: 5, p: REFERENT_PK, s: MY_PK, m: '', i: '', h: 'deadbeef',
    ...overrides,
  };
}

let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordAutomatic'>>;
let dialogSpy: jasmine.SpyObj<Pick<Dialog, 'open'>>;

describe('PrintPapers', () => {
  let component: PrintPapers;
  let fixture: ComponentFixture<PrintPapers>;

  beforeEach(async () => {
    fakeBlockchain = {
      getAvailableMoneyAmount: () => 100,
      generatePaper: jasmine.createSpy('generatePaper').and.callFake(() => TransactionMaker.make(makePaperTxWire())),
    };
    fakeAccount = {
      name: 'Alice',
      contacts: [],
      blockchain: fakeBlockchain,
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => 'the-real-sk',
      isReadOnlySession: () => false,
    };
    backupSpy = jasmine.createSpyObj('BackupService', ['recordAutomatic']);
    dialogSpy = jasmine.createSpyObj('Dialog', ['open']);
    dialogSpy.open.and.returnValue({ closed: of(undefined) } as any);

    await TestBed.configureTestingModule({
      imports: [PrintPapers, RouterTestingModule],
      providers: [
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: BackupService, useValue: backupSpy },
        { provide: Dialog, useValue: dialogSpy },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrintPapers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('getPaperTx() should produce an OM1:PP QR that decodes back to an equivalent paper', () => {
    const paper = TransactionMaker.make(makePaperTxWire());

    const qr = component.getPaperTx(paper);
    const decoded = decodeQr(qr);

    expect(decoded.type).toBe('PP');
    if (decoded.type === 'PP') {
      expect(decoded.payload.tx.h).toBe('deadbeef');
      expect(decoded.payload.tx.s).toBe(MY_PK);
    }
  });

  it('generatePapers() should record the mutation via backup.service', () => {
    component.papercounts[5] = 1;

    component.generatePapers();

    expect(backupSpy.recordAutomatic).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
  });

  it('should not generate any paper when the session is read-only', () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    component.papercounts[5] = 1;

    component.generatePapers();

    expect(fakeBlockchain.generatePaper).not.toHaveBeenCalled();
    expect(backupSpy.recordAutomatic).not.toHaveBeenCalled();
  });
});
