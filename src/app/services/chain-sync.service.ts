import { DestroyRef, Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { CitizenBlockchain } from 'organic-money/src/index.js';
import { TxType } from 'organic-protocol';
import type { BlockWire, MyValidationResponse, TxWire } from 'organic-protocol';
import { ServerConnexionService } from './server-connection.service';
import {
  ACCOUNT_NOT_STORED_MESSAGE,
  LocalDatabaseService,
  LocalSaveError,
} from './local-database.service';
import { BackupService } from './backup.service';
import { ConnectedUserService } from './connected-user.service';
import { isDeviceRevoked } from './server-error.util';
import { isBackedUp, markAsBackedUp, type LoadedAccount } from '../models/account';

const SERVER_ANSWER_TIMEOUT_MS = 5_000;
const SERVER_RECEPTION_TIMEOUT_MS = 10_000;
const SYNC_IMPOSSIBLE_MESSAGE_DURATION_MS = 8_000;
const SYNC_IMPOSSIBLE_MESSAGE =
  "Synchronisation impossible avec le serveur : ce téléphone garde sa copie pour l'instant.";
const SYNC_FAILED_MESSAGE =
  'La synchronisation a échoué : ce téléphone garde sa copie. Recharge la page pour réessayer.';
const MONEY_MOVEMENTS = [TxType.PAY, TxType.ENGAGE, TxType.PAPER, TxType.PAYERORDER, TxType.EARN];

function transactionsOf(chain: BlockWire[]): TxWire[] {
  return chain.flatMap((block) => block.x);
}

function transactionsMissingFrom(chain: BlockWire[], otherChain: BlockWire[]): TxWire[] {
  const hashes = new Set(transactionsOf(chain).map((transaction) => transaction.h));
  return transactionsOf(otherChain).filter((transaction) => !hashes.has(transaction.h));
}

function isTheServerAhead(deviceChain: BlockWire[], serverChain: BlockWire[]): boolean {
  return transactionsMissingFrom(serverChain, deviceChain).length === 0;
}

function isTheDeviceAhead(deviceChain: BlockWire[], serverChain: BlockWire[]): boolean {
  return transactionsMissingFrom(deviceChain, serverChain).length === 0;
}

function isTheSameAccountState(account: LoadedAccount, serverCopy: MyValidationResponse): boolean {
  return (
    account.status === serverCopy.status &&
    JSON.stringify(account.blockchain.export()) === JSON.stringify(serverCopy.blocks)
  );
}

function movesMoneyOrInvests(transaction: TxWire): boolean {
  return MONEY_MOVEMENTS.includes(transaction.t);
}

function isPendingOffline(account: LoadedAccount, transaction: TxWire): boolean {
  return (
    account.sentOfflineTx?.some((sent) => sent.h === transaction.h) ||
    account.pendingOfflineTx?.some((pending) => pending.tx.h === transaction.h) ||
    false
  );
}

function lostOperationsMessage(numberOfLostOperations: number): string {
  const whatWasLost =
    numberOfLostOperations > 1
      ? `${numberOfLostOperations} opérations faites ici n'ont pas été gardées`
      : `${numberOfLostOperations} opération faite ici n'a pas été gardée`;
  return `Ce téléphone n'était plus d'accord avec le serveur : sa copie a été reprise, et ${whatWasLost}.`;
}

function cannotReachTheServer(error: unknown): boolean {
  return (
    !(error instanceof HttpErrorResponse) ||
    error.status === 0 ||
    error.status >= 500 ||
    error.status === 429
  );
}

function isBelongingTo(account: LoadedAccount, chain: any): boolean {
  return chain.getMyPublicKey() === account.publickey && chain.isValid();
}

@Injectable({ providedIn: 'root' })
export class ChainSyncService {
  private server = inject(ServerConnexionService);
  private localDB = inject(LocalDatabaseService);
  private backup = inject(BackupService);
  private snackBar = inject(MatSnackBar);
  private userService = inject(ConnectedUserService);
  private destroyRef = inject(DestroyRef);
  private runningSync: Promise<void> | null = null;

  private sayTheSyncIsImpossible(): void {
    this.snackBar.open(SYNC_IMPOSSIBLE_MESSAGE, 'Fermer', {
      duration: SYNC_IMPOSSIBLE_MESSAGE_DURATION_MS,
    });
  }

  private async fetchTheServerCopy(
    account: LoadedAccount,
    secretKey: string,
  ): Promise<MyValidationResponse | null> {
    try {
      return await firstValueFrom(
        this.server
          .getMyValidation(account.serverUrl, account.publickey, secretKey)
          .pipe(timeout(SERVER_ANSWER_TIMEOUT_MS)),
      );
    } catch (error) {
      console.error(error);
      this.sayTheSyncIsImpossible();
      return null;
    }
  }

  private newestSignedBlockSignature(account: LoadedAccount): string | null {
    return account.blockchain.blocks.find((block: any) => block.isSigned())?.signature ?? null;
  }

  private async isStoredOnThisDevice(account: LoadedAccount): Promise<boolean> {
    try {
      await this.localDB.saveUser(account);
      return true;
    } catch (error) {
      if (!(error instanceof LocalSaveError)) {
        throw error;
      }
      console.error(error);
      return false;
    }
  }

  private async takeTheServerChain(
    account: LoadedAccount,
    serverCopy: MyValidationResponse,
  ): Promise<boolean> {
    const serverChain = new CitizenBlockchain(serverCopy.blocks);
    if (!isBelongingTo(account, serverChain)) {
      console.error('The server holds a chain that is not this account’s, or an invalid one.');
      this.sayTheSyncIsImpossible();
      return true;
    }
    account.blockchain = serverChain;
    account.status = serverCopy.status;
    account.lastSavedBlockSignature = this.newestSignedBlockSignature(account);
    markAsBackedUp(account);
    return this.isStoredOnThisDevice(account);
  }

  private async catchUpWithTheServer(
    account: LoadedAccount,
    serverCopy: MyValidationResponse,
  ): Promise<void> {
    if (!(await this.takeTheServerChain(account, serverCopy))) {
      this.snackBar.open(ACCOUNT_NOT_STORED_MESSAGE, 'Fermer');
    }
  }

  private wouldLoseMoneyMovements(account: LoadedAccount, lostTransactions: TxWire[]): boolean {
    return lostTransactions.some(
      (transaction) => movesMoneyOrInvests(transaction) || isPendingOffline(account, transaction),
    );
  }

  private async giveUpTheDeviceChain(
    account: LoadedAccount,
    serverCopy: MyValidationResponse,
  ): Promise<void> {
    const lostTransactions = transactionsMissingFrom(
      serverCopy.blocks,
      account.blockchain.export(),
    );
    if (this.wouldLoseMoneyMovements(account, lostTransactions)) {
      this.userService.markOutOfSync();
      return;
    }
    const isStored = await this.takeTheServerChain(account, serverCopy);
    const lostMessage = lostOperationsMessage(lostTransactions.length);
    this.snackBar.open(
      isStored ? lostMessage : `${lostMessage} ${ACCOUNT_NOT_STORED_MESSAGE}`,
      'Fermer',
    );
  }

  private async sendTheDeviceChain(account: LoadedAccount, secretKey: string): Promise<void> {
    if (this.userService.isReadOnlySession()) {
      return;
    }
    try {
      await firstValueFrom(
        this.backup.pushToServer(account, secretKey).pipe(timeout(SERVER_RECEPTION_TIMEOUT_MS)),
      );
    } catch (error) {
      console.error(error);
      if (isDeviceRevoked(error)) {
        return;
      }
      if (cannotReachTheServer(error)) {
        this.sayTheSyncIsImpossible();
        return;
      }
      const serverCopy = await this.fetchTheServerCopy(account, secretKey);
      if (serverCopy !== null) {
        await this.giveUpTheDeviceChain(account, serverCopy);
      }
    }
  }

  private confirmTheBackup(account: LoadedAccount): void {
    if (isBackedUp(account)) {
      return;
    }
    markAsBackedUp(account);
    this.localDB.saveUserInBackground(account);
  }

  async syncWithServer(account: LoadedAccount, secretKey: string): Promise<void> {
    const serverCopy = await this.fetchTheServerCopy(account, secretKey);
    if (serverCopy === null) {
      return;
    }
    if (isTheSameAccountState(account, serverCopy)) {
      this.confirmTheBackup(account);
      return;
    }
    const deviceChain = account.blockchain.export();
    if (isTheServerAhead(deviceChain, serverCopy.blocks)) {
      await this.catchUpWithTheServer(account, serverCopy);
      return;
    }
    if (isTheDeviceAhead(deviceChain, serverCopy.blocks)) {
      await this.sendTheDeviceChain(account, secretKey);
      return;
    }
    await this.giveUpTheDeviceChain(account, serverCopy);
  }

  private async syncOrSayItFailed(): Promise<void> {
    try {
      await this.syncWithServer(
        this.userService.getConnectedUser(),
        this.userService.getSecretKey(),
      );
    } catch (error) {
      console.error(error);
      this.snackBar.open(SYNC_FAILED_MESSAGE, 'Fermer');
    }
  }

  syncTheConnectedAccount(): Promise<void> {
    if (!this.userService.isUnlocked()) {
      return Promise.resolve();
    }
    this.runningSync ??= this.syncOrSayItFailed().finally(() => {
      this.runningSync = null;
    });
    return this.runningSync;
  }

  private syncWhenBackOnline = (): void => {
    if (this.userService.isReadOnlySession()) {
      return;
    }
    this.syncTheConnectedAccount();
  };

  startSyncingWhenBackOnline(): void {
    window.addEventListener('online', this.syncWhenBackOnline);
    this.destroyRef.onDestroy(() => window.removeEventListener('online', this.syncWhenBackOnline));
  }
}
