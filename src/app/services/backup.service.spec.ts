import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { BackupService } from './backup.service';
import { LocalDatabaseService } from './local-database.service';
import { ServerConnexionService } from './server-connection.service';
import { ConnectedUserService } from './connected-user.service';
import { CitizenBlockchain } from 'organic-money/src/index.js';

const VALIDATOR_SK = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f';
const RECIPIENT_PK = '03' + 'd4'.repeat(32);

function makeAccountWithMoney(): { account: any; sk: string } {
  const blockchain = new CitizenBlockchain();
  const sk = blockchain.startBlockchain('Camille', new Date(2000, 0, 1), VALIDATOR_SK);
  blockchain.createMoneyAndInvests(sk);
  return { account: { backupPolicy: 'manual', lastSavedBlockSignature: null, blockchain }, sk };
}

let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'saveBlock'>>;
let userServiceSpy: jasmine.SpyObj<Pick<ConnectedUserService, 'setReadOnly'>>;
let fakeUser: any;

// A fake "block": just enough shape for blocksNeedingSync's findIndex/isSigned/signature use.
function fakeBlock(signature: string, signed = true): any {
  return { signature, isSigned: () => signed };
}

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    const currentBlock = fakeBlock('sig-current', false);
    fakeUser = {
      backupPolicy: 'every-tx',
      lastBackupAt: null,
      isuptodate: false,
      // The server already has this exact block as its last one — no backlog.
      lastSavedBlockSignature: 'sig-current',
      blockchain: {
        blocks: [currentBlock],
        getMyPublicKey: () => 'pk',
      },
    };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['saveBlock']);
    serverDBSpy.saveBlock.and.returnValue(of({}));
    userServiceSpy = jasmine.createSpyObj('ConnectedUserService', ['setReadOnly']);

    TestBed.configureTestingModule({
      providers: [
        BackupService,
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: ServerConnexionService, useValue: serverDBSpy },
        { provide: ConnectedUserService, useValue: userServiceSpy },
      ],
    });

    service = TestBed.inject(BackupService);
  });

  it('recordAutomatic should always save locally', () => {
    service.recordAutomatic(fakeUser, 'sk');
    expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeUser);
  });

  it('recordAutomatic should push to the server under every-tx', () => {
    fakeUser.backupPolicy = 'every-tx';
    service.recordAutomatic(fakeUser, 'sk');
    expect(serverDBSpy.saveBlock).toHaveBeenCalledWith(fakeUser, 'sk', fakeUser.blockchain.blocks[0]);
  });

  it('recordAutomatic should not push to the server under manual or payments-only', () => {
    fakeUser.backupPolicy = 'manual';
    service.recordAutomatic(fakeUser, 'sk');
    expect(serverDBSpy.saveBlock).not.toHaveBeenCalled();

    fakeUser.backupPolicy = 'payments-only';
    service.recordAutomatic(fakeUser, 'sk');
    expect(serverDBSpy.saveBlock).not.toHaveBeenCalled();
  });

  it('recordPayment should always push to the server, regardless of policy', () => {
    fakeUser.backupPolicy = 'manual';
    service.recordPayment(fakeUser, 'sk').subscribe();
    expect(serverDBSpy.saveBlock).toHaveBeenCalledWith(fakeUser, 'sk', fakeUser.blockchain.blocks[0]);
  });

  it('should update lastBackupAt and isuptodate on a successful push', () => {
    service.recordPayment(fakeUser, 'sk').subscribe();
    expect(fakeUser.isuptodate).toBeTrue();
    expect(fakeUser.lastBackupAt).not.toBeNull();
    expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeUser);
  });

  it('should mark the session read-only on a 409', () => {
    serverDBSpy.saveBlock.and.returnValue(throwError(() => ({ status: 409 })));
    service.recordPayment(fakeUser, 'sk').subscribe({ error: () => {} });
    expect(userServiceSpy.setReadOnly).toHaveBeenCalled();
  });

  it('recordPayment should not issue a second server request when the caller subscribes to the returned observable', () => {
    let subscribeCount = 0;
    serverDBSpy.saveBlock.and.returnValue(new Observable((subscriber) => {
      subscribeCount++;
      subscriber.next({});
      subscriber.complete();
    }));

    // Mirrors real usage in pay.ts: the caller subscribes to what recordPayment returns.
    service.recordPayment(fakeUser, 'sk').subscribe();

    expect(subscribeCount).toBe(1);
  });

  it('should catch up on blocks closed locally since the last confirmed save, oldest first, before the current one', () => {
    const oldSaved = fakeBlock('sig-old-saved');
    const closedA = fakeBlock('sig-a');
    const closedB = fakeBlock('sig-b');
    const current = fakeBlock('sig-current', false);
    // Newest-first, as Blockchain.blocks is ordered — closedA/closedB were
    // closed locally but never made it to the server (e.g. offline).
    fakeUser.blockchain.blocks = [current, closedB, closedA, oldSaved];
    fakeUser.lastSavedBlockSignature = 'sig-old-saved';

    const sentBlocks: any[] = [];
    serverDBSpy.saveBlock.and.callFake((_user: any, _sk: any, block: any) => {
      sentBlocks.push(block);
      return of({});
    });

    service.recordPayment(fakeUser, 'sk').subscribe();

    expect(sentBlocks).toEqual([closedA, closedB, current]);
  });

  it('should update lastSavedBlockSignature to the newest signed block actually confirmed by the server', () => {
    const oldKnown = fakeBlock('sig-old-known');
    const closedA = fakeBlock('sig-a');
    const current = fakeBlock('sig-current', false);
    fakeUser.blockchain.blocks = [current, closedA, oldKnown];
    fakeUser.lastSavedBlockSignature = 'sig-old-known';

    service.recordPayment(fakeUser, 'sk').subscribe();

    // closedA is signed (its signature is now confirmed server-side); the
    // still-open current block has no stable signature to point to.
    expect(fakeUser.lastSavedBlockSignature).toBe('sig-a');
  });

  it('should stop and not send later blocks once one save in the sequence fails', () => {
    const oldKnown = fakeBlock('sig-old-known');
    const closedA = fakeBlock('sig-a');
    const current = fakeBlock('sig-current', false);
    fakeUser.blockchain.blocks = [current, closedA, oldKnown];
    fakeUser.lastSavedBlockSignature = 'sig-old-known';

    let callCount = 0;
    serverDBSpy.saveBlock.and.callFake(() => {
      callCount++;
      return throwError(() => ({ status: 500 }));
    });

    service.recordPayment(fakeUser, 'sk').subscribe({ error: () => {} });

    expect(callCount).toBe(1);
  });

  describe('applyAndSave', () => {
    it('should apply the change, save it on the server and return its result', () => {
      const { account, sk } = makeAccountWithMoney();
      let result: any;

      service.applyAndSave(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1))
        .subscribe((tx) => (result = tx));

      expect(result.target).toBe(RECIPIENT_PK);
      expect(serverDBSpy.saveBlock).toHaveBeenCalledWith(account, sk, account.blockchain.blocks[0]);
    });

    it('should undo the change and save the undone chain locally when the server save fails', () => {
      serverDBSpy.saveBlock.and.returnValue(throwError(() => ({ status: 0 })));
      const { account, sk } = makeAccountWithMoney();
      const moneyBefore = account.blockchain.getAvailableMoneyAmount();
      const experienceBefore = account.blockchain.experience;

      service.applyAndSave(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1))
        .subscribe({ error: () => {} });

      expect(account.blockchain.getAvailableMoneyAmount()).toBe(moneyBefore);
      expect(account.blockchain.experience).toBe(experienceBefore);
      expect(localDBSpy.saveUser).toHaveBeenCalledTimes(2);
      const savedAccount: any = localDBSpy.saveUser.calls.mostRecent().args[0];
      expect(savedAccount.blockchain.getAvailableMoneyAmount()).toBe(moneyBefore);
    });

    it('should not save anything when the change itself fails', () => {
      const { account, sk } = makeAccountWithMoney();
      let failure: any;

      service.applyAndSave(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1000))
        .subscribe({ error: (err) => (failure = err) });

      expect(failure).toBeTruthy();
      expect(serverDBSpy.saveBlock).not.toHaveBeenCalled();
      expect(localDBSpy.saveUser).not.toHaveBeenCalled();
    });

    it('should undo what the change already did when it fails halfway', () => {
      const { account, sk } = makeAccountWithMoney();
      const moneyBefore = account.blockchain.getAvailableMoneyAmount();

      service.applyAndSave(account, sk, () => {
        account.blockchain.pay(sk, RECIPIENT_PK, 1);
        throw new Error('boom');
      }).subscribe({ error: () => {} });

      expect(account.blockchain.getAvailableMoneyAmount()).toBe(moneyBefore);
    });
  });
});
