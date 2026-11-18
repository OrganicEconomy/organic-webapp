import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CitizenBlockchain } from 'organic-money/src/index.js';

import { ChainSyncService } from './chain-sync.service';
import { ServerConnexionService } from './server-connection.service';
import {
  ACCOUNT_NOT_STORED_MESSAGE,
  InUseElsewhereError,
  LocalDatabaseService,
  LocalSaveError,
} from './local-database.service';
import { BackupService } from './backup.service';
import { ConnectedUserService } from './connected-user.service';

const VALIDATOR_SK = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f';
const RECIPIENT_PK = '03' + 'd4'.repeat(32);
const OTHER_RECIPIENT_PK = '02' + 'e5'.repeat(32);
const SYNC_IMPOSSIBLE = /Synchronisation impossible/;

function accountWithMoney(): { account: any; secretKey: string } {
  const blockchain = new CitizenBlockchain();
  const secretKey = blockchain.startBlockchain('Camille', new Date(2000, 0, 1), VALIDATOR_SK);
  blockchain.createMoneyAndInvests(secretKey);
  return {
    account: {
      publickey: blockchain.getMyPublicKey(),
      serverUrl: 'https://trifouillis.fr',
      status: 'active',
      contacts: [],
      blocks: blockchain.export(),
      blockchain,
    },
    secretKey,
  };
}

function chainAfterAPayment(account: any, secretKey: string, recipient = RECIPIENT_PK): any[] {
  const later = new CitizenBlockchain(account.blockchain.export());
  later.pay(secretKey, recipient, 1);
  return later.export();
}

function chainWithAnExtraCreation(account: any): any[] {
  const chain = account.blockchain.export();
  const creation = chain
    .flatMap((block: any) => block.x)
    .find((transaction: any) => transaction.t === 2);
  chain[0].x.push({ ...creation, h: 'a-creation-made-on-this-device-only' });
  return chain;
}

describe('ChainSyncService', () => {
  let service: ChainSyncService;
  let serverSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'getMyValidation'>>;
  let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
  let backupSpy: jasmine.SpyObj<Pick<BackupService, 'pushToServer'>>;
  let snackBarSpy: jasmine.SpyObj<Pick<MatSnackBar, 'open'>>;
  let userServiceStub: {
    isUnlocked: () => boolean;
    isReadOnlySession: () => boolean;
    getConnectedUser: () => any;
    getSecretKey: () => string;
    markOutOfSync: jasmine.Spy;
    readOnlyMessage: () => string;
  };
  let connected: { account: any; secretKey: string } | null;
  let readOnly: boolean;

  function serverHolds(blocks: any[], status = 'active'): void {
    serverSpy.getMyValidation.and.returnValue(of({ status, blocks } as any));
  }

  beforeEach(() => {
    serverSpy = jasmine.createSpyObj('ServerConnexionService', ['getMyValidation']);
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    localDBSpy.saveUser.and.callFake(async (account) => account);
    backupSpy = jasmine.createSpyObj('BackupService', ['pushToServer']);
    backupSpy.pushToServer.and.returnValue(of({}));
    snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);
    connected = null;
    readOnly = false;
    userServiceStub = {
      isUnlocked: () => connected !== null && connected.secretKey !== '',
      isReadOnlySession: () => readOnly,
      getConnectedUser: () => connected?.account ?? null,
      getSecretKey: () => connected?.secretKey ?? '',
      markOutOfSync: jasmine.createSpy('markOutOfSync'),
      readOnlyMessage: () => "Ce téléphone et le serveur ne sont plus d'accord sur des paiements.",
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ServerConnexionService, useValue: serverSpy },
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: BackupService, useValue: backupSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
        { provide: ConnectedUserService, useValue: userServiceStub },
      ],
    });
    service = TestBed.inject(ChainSyncService);
    spyOn(console, 'error');
  });

  afterEach(() => jasmine.clock().uninstall());

  describe('syncWithServer', () => {
    it('should change nothing when the device and the server hold the same chain', async () => {
      const { account, secretKey } = accountWithMoney();
      serverHolds(account.blockchain.export());

      await service.syncWithServer(account, secretKey);

      expect(localDBSpy.saveUser).not.toHaveBeenCalled();
      expect(backupSpy.pushToServer).not.toHaveBeenCalled();
    });

    it('should take the chain of the server when it holds more, keeping the contacts of the device', async () => {
      const { account, secretKey } = accountWithMoney();
      account.contacts = [{ name: 'Zoé', pk: 'pk-zoe', url: '', type: 'citizen' }];
      const serverChain = chainAfterAPayment(account, secretKey);
      serverHolds(serverChain);

      await service.syncWithServer(account, secretKey);

      expect(account.blockchain.export()).toEqual(serverChain);
      expect(account.contacts).toEqual([{ name: 'Zoé', pk: 'pk-zoe', url: '', type: 'citizen' }]);
      expect(localDBSpy.saveUser).toHaveBeenCalledWith(account);
    });

    it('should take the status of the server with its chain', async () => {
      const { account, secretKey } = accountWithMoney();
      account.status = 'pending-validation';
      serverHolds(account.blockchain.export(), 'active');

      await service.syncWithServer(account, secretKey);

      expect(account.status).toBe('active');
    });

    it('should remember the newest signed block of the server as the last one it confirmed', async () => {
      const { account, secretKey } = accountWithMoney();
      const serverChain = chainAfterAPayment(account, secretKey);
      serverHolds(serverChain);

      await service.syncWithServer(account, secretKey);

      const newestSignedBlock = new CitizenBlockchain(serverChain).blocks.find((block: any) =>
        block.isSigned(),
      );
      expect(account.lastSavedBlockSignature).toBe(newestSignedBlock.signature);
      expect(account.isuptodate).toBeTrue();
    });

    it('should refuse a chain of the server that is not this account’s, keeping the copy of the device', async () => {
      const { account, secretKey } = accountWithMoney();
      const deviceChain = account.blockchain.export();
      serverHolds(accountWithMoney().account.blockchain.export());

      await service.syncWithServer(account, secretKey);

      expect(account.blockchain.export()).toEqual(deviceChain);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringMatching(SYNC_IMPOSSIBLE),
        'Fermer',
        {
          duration: 8_000,
        },
      );
    });

    it('should say so when this device cannot store the chain of the server', async () => {
      const { account, secretKey } = accountWithMoney();
      serverHolds(chainAfterAPayment(account, secretKey));
      localDBSpy.saveUser.and.rejectWith(new LocalSaveError('device full'));

      await service.syncWithServer(account, secretKey);

      expect(snackBarSpy.open).toHaveBeenCalledWith(ACCOUNT_NOT_STORED_MESSAGE, 'Fermer');
    });

    it('should send to the server what the device holds and the server does not', async () => {
      const { account, secretKey } = accountWithMoney();
      serverHolds(account.blockchain.export());
      const deviceChain = chainAfterAPayment(account, secretKey);
      account.blockchain = new CitizenBlockchain(deviceChain);

      await service.syncWithServer(account, secretKey);

      expect(backupSpy.pushToServer).toHaveBeenCalledWith(account, secretKey);
      expect(account.blockchain.export()).toEqual(deviceChain);
    });

    it('should send nothing from a read-only session', async () => {
      const { account, secretKey } = accountWithMoney();
      serverHolds(account.blockchain.export());
      account.blockchain = new CitizenBlockchain(chainAfterAPayment(account, secretKey));
      readOnly = true;

      await service.syncWithServer(account, secretKey);

      expect(backupSpy.pushToServer).not.toHaveBeenCalled();
    });

    it('should keep the copy of the device when the server fails while receiving it', async () => {
      const { account, secretKey } = accountWithMoney();
      serverHolds(account.blockchain.export());
      const deviceChain = chainAfterAPayment(account, secretKey);
      account.blockchain = new CitizenBlockchain(deviceChain);
      backupSpy.pushToServer.and.returnValue(throwError(() => new HttpErrorResponse({ status: 502 })));

      await service.syncWithServer(account, secretKey);

      expect(account.blockchain.export()).toEqual(deviceChain);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringMatching(SYNC_IMPOSSIBLE),
        'Fermer',
        {
          duration: 8_000,
        },
      );
    });

    it('should keep the copy of the device when another device took the account over', async () => {
      const { account, secretKey } = accountWithMoney();
      serverHolds(account.blockchain.export());
      const deviceChain = chainAfterAPayment(account, secretKey);
      account.blockchain = new CitizenBlockchain(deviceChain);
      backupSpy.pushToServer.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'DEVICE_REVOKED' } })),
      );

      await service.syncWithServer(account, secretKey);

      expect(account.blockchain.export()).toEqual(deviceChain);
    });

    it('should keep the copy of the device when the server takes too long to receive it', async () => {
      jasmine.clock().install();
      const { account, secretKey } = accountWithMoney();
      serverHolds(account.blockchain.export());
      const deviceChain = chainAfterAPayment(account, secretKey);
      account.blockchain = new CitizenBlockchain(deviceChain);
      backupSpy.pushToServer.and.returnValue(NEVER);

      const syncing = service.syncWithServer(account, secretKey);
      while (!backupSpy.pushToServer.calls.any()) {
        await Promise.resolve();
      }
      jasmine.clock().tick(10_000);
      await syncing;

      expect(account.blockchain.export()).toEqual(deviceChain);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringMatching(SYNC_IMPOSSIBLE),
        'Fermer',
        {
          duration: 8_000,
        },
      );
    });

    it('should keep the payments of the device, read-only, when the server holds other ones', async () => {
      const { account, secretKey } = accountWithMoney();
      serverHolds(chainAfterAPayment(account, secretKey, OTHER_RECIPIENT_PK));
      const deviceChain = chainAfterAPayment(account, secretKey);
      account.blockchain = new CitizenBlockchain(deviceChain);

      await service.syncWithServer(account, secretKey);

      expect(account.blockchain.export()).toEqual(deviceChain);
      expect(userServiceStub.markOutOfSync).toHaveBeenCalled();
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        "Ce téléphone et le serveur ne sont plus d'accord sur des paiements.",
        'Fermer',
      );
    });

    it('should keep the payments of the device, read-only, when the server refuses them', async () => {
      const { account, secretKey } = accountWithMoney();
      serverHolds(account.blockchain.export());
      const deviceChain = chainAfterAPayment(account, secretKey);
      account.blockchain = new CitizenBlockchain(deviceChain);
      backupSpy.pushToServer.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400 })));

      await service.syncWithServer(account, secretKey);

      expect(account.blockchain.export()).toEqual(deviceChain);
      expect(userServiceStub.markOutOfSync).toHaveBeenCalled();
    });

    it('should take the chain of the server, and say what was lost, when only creations of the day differ', async () => {
      const { account, secretKey } = accountWithMoney();
      const serverChain = chainAfterAPayment(account, secretKey);
      serverHolds(serverChain);
      account.blockchain = new CitizenBlockchain(chainWithAnExtraCreation(account));

      await service.syncWithServer(account, secretKey);

      expect(account.blockchain.export()).toEqual(serverChain);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        "Ce téléphone n'était plus d'accord avec le serveur : sa copie a été reprise, et 1 opération faite ici n'a pas été gardée.",
        'Fermer',
      );
    });

    it('should say in a single message what was lost and that this device could not store the rest', async () => {
      const { account, secretKey } = accountWithMoney();
      serverHolds(chainAfterAPayment(account, secretKey));
      account.blockchain = new CitizenBlockchain(chainWithAnExtraCreation(account));
      localDBSpy.saveUser.and.rejectWith(new LocalSaveError('device full'));

      await service.syncWithServer(account, secretKey);

      expect(snackBarSpy.open).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/1 opération faite ici n'a pas été gardée.*n'a pas pu enregistrer/),
        'Fermer',
      );
    });

    it('should keep the copy of the device, and say so, when the server cannot be reached', async () => {
      const { account, secretKey } = accountWithMoney();
      const deviceChain = account.blockchain.export();
      serverSpy.getMyValidation.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 0 })),
      );

      await service.syncWithServer(account, secretKey);

      expect(account.blockchain.export()).toEqual(deviceChain);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        "Synchronisation impossible avec le serveur : ce téléphone garde sa copie pour l'instant.",
        'Fermer',
        { duration: 8_000 },
      );
    });

    it('should give up after 5 seconds without an answer, keeping the copy of the device', async () => {
      jasmine.clock().install();
      const { account, secretKey } = accountWithMoney();
      serverSpy.getMyValidation.and.returnValue(NEVER);

      const syncing = service.syncWithServer(account, secretKey);
      jasmine.clock().tick(5_000);
      await syncing;

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringMatching(SYNC_IMPOSSIBLE),
        'Fermer',
        {
          duration: 8_000,
        },
      );
    });
  });

  describe('syncTheConnectedAccount', () => {
    it('should sync the account connected and unlocked in this tab', async () => {
      connected = accountWithMoney();
      serverHolds(connected.account.blockchain.export());

      await service.syncTheConnectedAccount();

      expect(serverSpy.getMyValidation).toHaveBeenCalled();
    });

    it('should ask nothing of the server for a locked session', async () => {
      connected = { account: accountWithMoney().account, secretKey: '' };

      await service.syncTheConnectedAccount();

      expect(serverSpy.getMyValidation).not.toHaveBeenCalled();
    });

    it('should report, without stopping its caller, a sync that fails unexpectedly', async () => {
      connected = accountWithMoney();
      serverHolds(chainAfterAPayment(connected.account, connected.secretKey));
      localDBSpy.saveUser.and.rejectWith(new InUseElsewhereError('in another tab'));

      await expectAsync(service.syncTheConnectedAccount()).toBeResolved();
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringMatching(/La synchronisation a échoué/),
        'Fermer',
      );
    });
  });
});
