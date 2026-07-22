import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PendingPaymentsService } from './pending-payments.service';
import { ConnectedUserService } from './connected-user.service';
import { LocalDatabaseService } from './local-database.service';
import { ServerConnexionService } from './server-connection.service';
import { LevelUpService } from './level-up.service';

const MY_PK = '02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3';
const SENDER_PK = '0306ffd8f4fe843f5f7183179dcf36f550326813f56ec824911abca9c9d1cd7834';

// A structurally well-formed PAY TxWire — enough for TransactionMaker.make()
// to construct a real Transaction instance and expose decoded properties
// (.date, .signer, .money, .signature). Not cryptographically signed: fine
// for display-transformation tests, which never call .isValid()/receivePay.
function makePayTxWire(overrides: Partial<any> = {}): any {
  return {
    v: 1, d: 20260722, t: 3, p: MY_PK, s: SENDER_PK, m: '', i: '', h: 'deadbeef',
    ...overrides,
  };
}

let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'saveLastBlock' | 'getTransactionList'>>;
let levelUpSpy: jasmine.SpyObj<Pick<LevelUpService, 'celebrateIfLevelUp'>>;

describe('PendingPaymentsService', () => {
  let service: PendingPaymentsService;

  beforeEach(() => {
    fakeBlockchain = {
      receivePay: jasmine.createSpy('receivePay'),
      getLevel: () => 2,
    };
    fakeAccount = {
      publickey: MY_PK,
      serverUrl: 'https://trifouillis.fr',
      contacts: [],
      blockchain: fakeBlockchain,
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => 'the-real-sk',
    };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['saveLastBlock', 'getTransactionList']);
    serverDBSpy.getTransactionList.and.returnValue(of([]));
    levelUpSpy = jasmine.createSpyObj('LevelUpService', ['celebrateIfLevelUp']);

    TestBed.configureTestingModule({
      providers: [
        PendingPaymentsService,
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: ServerConnexionService, useValue: serverDBSpy },
        { provide: LevelUpService, useValue: levelUpSpy },
      ],
    });

    service = TestBed.inject(PendingPaymentsService);
  });

  it('should turn a flat TxWire[] response into displayable rows (decoded fields, not wire letters)', () => {
    serverDBSpy.getTransactionList.and.returnValue(of([makePayTxWire()]));

    service.refresh();

    expect(service.dataSource.length).toBe(1);
    expect(service.dataSource[0].amount).toBe(0); // m: '' -> no money units
    expect(service.dataSource[0].hash).toBe('deadbeef');
    expect(service.dataSource[0].date).toContain('2026');
  });

  it('should call receivePay with a reconstructed Transaction instance, not the raw wire object', () => {
    const wireTx = makePayTxWire();
    serverDBSpy.getTransactionList.and.returnValue(of([wireTx]));
    service.refresh();
    const hash = service.dataSource[0].hash;

    service.cash(hash);

    expect(fakeBlockchain.receivePay).toHaveBeenCalledTimes(1);
    const receivedArg = fakeBlockchain.receivePay.calls.mostRecent().args[0];
    expect(receivedArg).not.toBe(wireTx);
    expect(receivedArg.signer).toBe(SENDER_PK); // decoded property, not the wire's "s" letter
  });

  it('should save locally and to the server after receiving a payment', () => {
    serverDBSpy.getTransactionList.and.returnValue(of([makePayTxWire()]));
    service.refresh();
    const hash = service.dataSource[0].hash;

    service.cash(hash);

    expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeAccount);
    expect(serverDBSpy.saveLastBlock).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
  });

  it('should ask LevelUpService to celebrate using the level captured before and after receiving', () => {
    fakeBlockchain.getLevel = jasmine.createSpy('getLevel').and.returnValues(2, 3);
    serverDBSpy.getTransactionList.and.returnValue(of([makePayTxWire()]));
    service.refresh();
    const hash = service.dataSource[0].hash;

    service.cash(hash);

    expect(levelUpSpy.celebrateIfLevelUp).toHaveBeenCalledWith(2, 3);
  });

  it('should skip a malformed transaction instead of crashing', () => {
    const goodTx = makePayTxWire();
    const malformedTx = { v: 1, d: 20260722, t: 999 /* unknown type */, p: MY_PK, s: SENDER_PK, m: '', i: '', h: 'x' };
    serverDBSpy.getTransactionList.and.returnValue(of([malformedTx, goodTx]));

    expect(() => service.refresh()).not.toThrow();

    expect(service.dataSource.length).toBe(1);
    expect(service.dataSource[0].hash).toBe('deadbeef');
  });
});
