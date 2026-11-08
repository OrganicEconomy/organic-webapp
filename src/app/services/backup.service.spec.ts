import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';

import { BackupService, UndoNotStoredError } from './backup.service';
import { LocalDatabaseService, LocalSaveError } from './local-database.service';
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

let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser' | 'saveUserInBackground'>>;
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
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser', 'saveUserInBackground']);
    localDBSpy.saveUser.and.callFake(async (account) => account);
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

  it('recordAutomatic should save locally in the background', () => {
    service.recordAutomatic(fakeUser, 'sk');
    expect(localDBSpy.saveUserInBackground).toHaveBeenCalledWith(fakeUser);
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

  it('should update lastBackupAt and isuptodate on a successful push', () => {
    service.saveNow(fakeUser, 'sk').subscribe();
    expect(fakeUser.isuptodate).toBeTrue();
    expect(fakeUser.lastBackupAt).not.toBeNull();
    expect(localDBSpy.saveUserInBackground).toHaveBeenCalledWith(fakeUser);
  });

  it('should mark the session read-only on a 409', () => {
    serverDBSpy.saveBlock.and.returnValue(throwError(() => ({ status: 409 })));
    service.saveNow(fakeUser, 'sk').subscribe({ error: () => {} });
    expect(userServiceSpy.setReadOnly).toHaveBeenCalled();
  });

  it('saveNow should not issue a second server request when the caller subscribes to the returned observable', () => {
    let subscribeCount = 0;
    serverDBSpy.saveBlock.and.returnValue(new Observable((subscriber) => {
      subscribeCount++;
      subscriber.next({});
      subscriber.complete();
    }));

    service.saveNow(fakeUser, 'sk').subscribe();

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

    service.saveNow(fakeUser, 'sk').subscribe();

    expect(sentBlocks).toEqual([closedA, closedB, current]);
  });

  it('should update lastSavedBlockSignature to the newest signed block actually confirmed by the server', () => {
    const oldKnown = fakeBlock('sig-old-known');
    const closedA = fakeBlock('sig-a');
    const current = fakeBlock('sig-current', false);
    fakeUser.blockchain.blocks = [current, closedA, oldKnown];
    fakeUser.lastSavedBlockSignature = 'sig-old-known';

    service.saveNow(fakeUser, 'sk').subscribe();

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

    service.saveNow(fakeUser, 'sk').subscribe({ error: () => {} });

    expect(callCount).toBe(1);
  });

  describe('applyAndSave', () => {
    it('should apply the change, save it on the server and return its result', async () => {
      const { account, sk } = makeAccountWithMoney();

      const result: any = await firstValueFrom(
        service.applyAndSave(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1)),
      );

      expect(result.target).toBe(RECIPIENT_PK);
      expect(serverDBSpy.saveBlock).toHaveBeenCalledWith(account, sk, account.blockchain.blocks[0]);
    });

    it('should undo the change and store the undone chain on this device when the server save fails', async () => {
      serverDBSpy.saveBlock.and.returnValue(throwError(() => ({ status: 0 })));
      const { account, sk } = makeAccountWithMoney();
      const chainBefore = account.blockchain.export();
      const storedChains: unknown[] = [];
      localDBSpy.saveUser.and.callFake(async (saved: any) => {
        storedChains.push(saved.blockchain.export());
        return saved;
      });

      const saving = firstValueFrom(service.applyAndSave(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1)));

      await expectAsync(saving).toBeRejected();
      expect(account.blockchain.export()).toEqual(chainBefore);
      expect(storedChains.length).toBe(2);
      expect(storedChains[1]).toEqual(chainBefore);
    });

    it('should say so when this device could not store the undo of a change the server refused', async () => {
      serverDBSpy.saveBlock.and.returnValue(throwError(() => ({ status: 0 })));
      localDBSpy.saveUser.and.returnValues(Promise.resolve({} as any), Promise.reject(new LocalSaveError('device full')));
      const { account, sk } = makeAccountWithMoney();

      const saving = firstValueFrom(service.applyAndSave(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1)));

      await expectAsync(saving).toBeRejectedWithError(UndoNotStoredError);
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

    it('should cancel the change without asking the server when the device cannot store it', async () => {
      localDBSpy.saveUser.and.rejectWith(new LocalSaveError('full'));
      const { account, sk } = makeAccountWithMoney();
      const moneyBefore = account.blockchain.getAvailableMoneyAmount();

      const saving = firstValueFrom(service.applyAndSave(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1)));

      await expectAsync(saving).toBeRejectedWithError(LocalSaveError);
      expect(serverDBSpy.saveBlock).not.toHaveBeenCalled();
      expect(account.blockchain.getAvailableMoneyAmount()).toBe(moneyBefore);
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

  describe('applyAndRecord', () => {
    it('should apply the change, store it on this device and return its result', async () => {
      const { account, sk } = makeAccountWithMoney();

      const tx: any = await service.applyAndRecord(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1));

      expect(tx.target).toBe(RECIPIENT_PK);
      expect(localDBSpy.saveUser).toHaveBeenCalledWith(account);
    });

    it('should undo the change, offline lists included, when this device cannot store it', async () => {
      localDBSpy.saveUser.and.rejectWith(new LocalSaveError('device full'));
      const { account, sk } = makeAccountWithMoney();
      account.sentOfflineTx = [];
      const moneyBefore = account.blockchain.getAvailableMoneyAmount();

      const recording = service.applyAndRecord(account, sk, () => {
        const tx = account.blockchain.pay(sk, RECIPIENT_PK, 1);
        account.sentOfflineTx.push(tx.export());
      });

      await expectAsync(recording).toBeRejectedWithError(LocalSaveError);
      expect(account.blockchain.getAvailableMoneyAmount()).toBe(moneyBefore);
      expect(account.sentOfflineTx).toEqual([]);
    });

    it('should then push to the server under every-tx', async () => {
      const { account, sk } = makeAccountWithMoney();
      account.backupPolicy = 'every-tx';

      await service.applyAndRecord(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1));

      expect(serverDBSpy.saveBlock).toHaveBeenCalled();
    });

    it('should not push to the server under manual', async () => {
      const { account, sk } = makeAccountWithMoney();

      await service.applyAndRecord(account, sk, () => account.blockchain.pay(sk, RECIPIENT_PK, 1));

      expect(serverDBSpy.saveBlock).not.toHaveBeenCalled();
    });
  });
});
