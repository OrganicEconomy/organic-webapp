import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CitizenBlockchain } from 'organic-money/src/index.js';

import { ChainSyncService } from './chain-sync.service';
import { ServerConnexionService } from './server-connection.service';
import {
  ACCOUNT_NOT_STORED_MESSAGE,
  LocalDatabaseService,
  LocalSaveError,
} from './local-database.service';
import { BackupService } from './backup.service';
import { ConnectedUserService } from './connected-user.service';

const VALIDATOR_SK = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f';
const RECIPIENT_PK = '03' + 'd4'.repeat(32);

const OTHER_RECIPIENT_PK = '02' + 'e5'.repeat(32);

function chainAfterAPayment(account: any, sk: string, recipient = RECIPIENT_PK): any[] {
  const later = new CitizenBlockchain(account.blockchain.export());
  later.pay(sk, recipient, 1);
  return later.export();
}

function accountWithMoney(): { account: any; sk: string } {
  const blockchain = new CitizenBlockchain();
  const sk = blockchain.startBlockchain('Camille', new Date(2000, 0, 1), VALIDATOR_SK);
  blockchain.createMoneyAndInvests(sk);
  const blocks = blockchain.export();
  return {
    account: {
      publickey: blockchain.getMyPublicKey(),
      serverUrl: 'https://trifouillis.fr',
      status: 'active',
      contacts: [],
      blocks,
      blockchain,
    },
    sk,
  };
}

describe('ChainSyncService', () => {
  let service: ChainSyncService;
  let serverSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'getMyValidation'>>;
  let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
  let backupSpy: jasmine.SpyObj<Pick<BackupService, 'saveNow'>>;
  let snackBarSpy: jasmine.SpyObj<Pick<MatSnackBar, 'open'>>;
  let connected: { account: any; sk: string } | null;

  beforeEach(() => {
    serverSpy = jasmine.createSpyObj('ServerConnexionService', ['getMyValidation']);
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    localDBSpy.saveUser.and.callFake(async (account) => account);
    backupSpy = jasmine.createSpyObj('BackupService', ['saveNow']);
    backupSpy.saveNow.and.returnValue(of({}));
    snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);
    connected = null;
    TestBed.configureTestingModule({
      providers: [
        { provide: ServerConnexionService, useValue: serverSpy },
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: BackupService, useValue: backupSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
        {
          provide: ConnectedUserService,
          useValue: {
            isUnlocked: () => connected !== null && connected.sk !== '',
            getConnectedUser: () => connected?.account ?? null,
            getSecretKey: () => connected?.sk ?? '',
          },
        },
      ],
    });
    service = TestBed.inject(ChainSyncService);
  });

  describe('syncWithServer', () => {
    it('should change nothing when the device and the server hold the same chain', async () => {
      const { account, sk } = accountWithMoney();
      serverSpy.getMyValidation.and.returnValue(
        of({ status: 'active', blocks: account.blockchain.export() }),
      );

      await service.syncWithServer(account, sk);

      expect(localDBSpy.saveUser).not.toHaveBeenCalled();
      expect(backupSpy.saveNow).not.toHaveBeenCalled();
    });

    it('should take the chain of the server when it holds more, keeping the contacts of the device', async () => {
      const { account, sk } = accountWithMoney();
      account.contacts = [{ name: 'Zoé', pk: 'pk-zoe', url: '', type: 'citizen' }];
      const serverChain = chainAfterAPayment(account, sk);
      serverSpy.getMyValidation.and.returnValue(of({ status: 'active', blocks: serverChain }));

      await service.syncWithServer(account, sk);

      expect(account.blockchain.export()).toEqual(serverChain);
      expect(account.contacts).toEqual([{ name: 'Zoé', pk: 'pk-zoe', url: '', type: 'citizen' }]);
      expect(localDBSpy.saveUser).toHaveBeenCalledWith(account);
    });

    it('should say so when this device cannot store the chain of the server', async () => {
      const { account, sk } = accountWithMoney();
      serverSpy.getMyValidation.and.returnValue(
        of({ status: 'active', blocks: chainAfterAPayment(account, sk) }),
      );
      localDBSpy.saveUser.and.rejectWith(new LocalSaveError('device full'));
      spyOn(console, 'error');

      await service.syncWithServer(account, sk);

      expect(snackBarSpy.open).toHaveBeenCalledWith(ACCOUNT_NOT_STORED_MESSAGE, 'Fermer');
    });

    it('should send to the server what the device holds and the server does not', async () => {
      const { account, sk } = accountWithMoney();
      const serverChain = account.blockchain.export();
      account.blockchain = new CitizenBlockchain(chainAfterAPayment(account, sk));
      serverSpy.getMyValidation.and.returnValue(of({ status: 'active', blocks: serverChain }));

      await service.syncWithServer(account, sk);

      expect(backupSpy.saveNow).toHaveBeenCalledWith(account, sk);
      expect(account.blockchain.export()).not.toEqual(serverChain);
    });

    it('should take the chain of the server when both went their own way, and say what was lost', async () => {
      const { account, sk } = accountWithMoney();
      const serverChain = chainAfterAPayment(account, sk, OTHER_RECIPIENT_PK);
      account.blockchain = new CitizenBlockchain(chainAfterAPayment(account, sk));
      serverSpy.getMyValidation.and.returnValue(of({ status: 'active', blocks: serverChain }));

      await service.syncWithServer(account, sk);

      expect(account.blockchain.export()).toEqual(serverChain);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        "Ce téléphone n'était plus d'accord avec le serveur : sa copie a été reprise, et 1 opération faite ici n'a pas été gardée.",
        'Fermer',
      );
    });

    it('should keep the copy of the device, and say so, when the server cannot be reached', async () => {
      const { account, sk } = accountWithMoney();
      const deviceChain = account.blockchain.export();
      serverSpy.getMyValidation.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 0 })),
      );
      spyOn(console, 'error');

      await service.syncWithServer(account, sk);

      expect(account.blockchain.export()).toEqual(deviceChain);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        "Synchronisation impossible avec le serveur : ce téléphone garde sa copie pour l'instant.",
        'Fermer',
        { duration: 8_000 },
      );
    });

    it('should give up after 5 seconds without an answer, keeping the copy of the device', async () => {
      jasmine.clock().install();
      const { account, sk } = accountWithMoney();
      serverSpy.getMyValidation.and.returnValue(NEVER);
      spyOn(console, 'error');

      const syncing = service.syncWithServer(account, sk);
      jasmine.clock().tick(5_000);
      await syncing;
      jasmine.clock().uninstall();

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringMatching(/Synchronisation impossible/),
        'Fermer',
        { duration: 8_000 },
      );
    });

    it('should take the chain of the server when it refuses what the device holds', async () => {
      const { account, sk } = accountWithMoney();
      const serverChain = account.blockchain.export();
      account.blockchain = new CitizenBlockchain(chainAfterAPayment(account, sk));
      serverSpy.getMyValidation.and.returnValue(of({ status: 'active', blocks: serverChain }));
      backupSpy.saveNow.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
      spyOn(console, 'error');

      await service.syncWithServer(account, sk);

      expect(account.blockchain.export()).toEqual(serverChain);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringMatching(/1 opération faite ici/),
        'Fermer',
      );
    });

    it('should keep the copy of the device when it cannot reach the server to send it', async () => {
      const { account, sk } = accountWithMoney();
      const serverChain = account.blockchain.export();
      const deviceChain = chainAfterAPayment(account, sk);
      account.blockchain = new CitizenBlockchain(deviceChain);
      serverSpy.getMyValidation.and.returnValue(of({ status: 'active', blocks: serverChain }));
      backupSpy.saveNow.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      spyOn(console, 'error');

      await service.syncWithServer(account, sk);

      expect(account.blockchain.export()).toEqual(deviceChain);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringMatching(/Synchronisation impossible/),
        'Fermer',
        { duration: 8_000 },
      );
    });
  });

  describe('syncTheConnectedAccount', () => {
    it('should sync the account connected and unlocked in this tab', async () => {
      connected = accountWithMoney();
      serverSpy.getMyValidation.and.returnValue(
        of({ status: 'active', blocks: connected.account.blockchain.export() }),
      );

      await service.syncTheConnectedAccount();

      expect(serverSpy.getMyValidation).toHaveBeenCalled();
    });

    it('should ask nothing of the server for a locked session', async () => {
      connected = { account: accountWithMoney().account, sk: '' };

      await service.syncTheConnectedAccount();

      expect(serverSpy.getMyValidation).not.toHaveBeenCalled();
    });
  });
});
