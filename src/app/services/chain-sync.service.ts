import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { lookupFailure } from '../utils/lookup-failure.util';
import { CitizenBlockchain } from 'organic-money/src/index.js';
import type { BlockWire, MyValidationResponse } from 'organic-protocol';
import { ServerConnexionService } from './server-connection.service';
import {
  ACCOUNT_NOT_STORED_MESSAGE,
  LocalDatabaseService,
  LocalSaveError,
} from './local-database.service';
import { BackupService } from './backup.service';
import { ConnectedUserService } from './connected-user.service';
import type { LoadedAccount } from '../models/account';

const SERVER_ANSWER_DELAY_MS = 5_000;
const SYNC_IMPOSSIBLE_MESSAGE_DURATION_MS = 8_000;
const SYNC_IMPOSSIBLE_MESSAGE =
  "Synchronisation impossible avec le serveur : ce téléphone garde sa copie pour l'instant.";

function transactionHashesOf(blocks: BlockWire[]): Set<string> {
  return new Set(blocks.flatMap((block) => block.x.map((transaction) => transaction.h)));
}

function holdsEveryTransactionOf(blocks: BlockWire[], otherBlocks: BlockWire[]): boolean {
  const hashes = transactionHashesOf(blocks);
  return [...transactionHashesOf(otherBlocks)].every((hash) => hashes.has(hash));
}

function transactionsMissingFrom(blocks: BlockWire[], otherBlocks: BlockWire[]): number {
  const hashes = transactionHashesOf(blocks);
  return [...transactionHashesOf(otherBlocks)].filter((hash) => !hashes.has(hash)).length;
}

function lostOperationsMessage(lostOperations: number): string {
  const operations =
    lostOperations > 1
      ? `${lostOperations} opérations faites ici n'ont pas été gardées`
      : `${lostOperations} opération faite ici n'a pas été gardée`;
  return `Ce téléphone n'était plus d'accord avec le serveur : sa copie a été reprise, et ${operations}.`;
}

function isTheSameChain(deviceBlocks: BlockWire[], serverBlocks: BlockWire[]): boolean {
  return JSON.stringify(deviceBlocks) === JSON.stringify(serverBlocks);
}

@Injectable({ providedIn: 'root' })
export class ChainSyncService {
  private server = inject(ServerConnexionService);
  private localDB = inject(LocalDatabaseService);
  private backup = inject(BackupService);
  private snackBar = inject(MatSnackBar);
  private userService = inject(ConnectedUserService);

  private newestSignedBlockSignature(account: LoadedAccount): string | null {
    return account.blockchain.blocks.find((block: any) => block.isSigned())?.signature ?? null;
  }

  private async adoptTheServerChain(
    account: LoadedAccount,
    stored: MyValidationResponse,
  ): Promise<void> {
    account.blockchain = new CitizenBlockchain(stored.blocks);
    account.status = stored.status;
    account.lastSavedBlockSignature = this.newestSignedBlockSignature(account);
    account.isuptodate = true;
    try {
      await this.localDB.saveUser(account);
    } catch (error) {
      if (!(error instanceof LocalSaveError)) {
        throw error;
      }
      console.error(error);
      this.snackBar.open(ACCOUNT_NOT_STORED_MESSAGE, 'Fermer');
    }
  }

  private async storedOnTheServer(
    account: LoadedAccount,
    sk: string,
  ): Promise<MyValidationResponse | null> {
    try {
      return await firstValueFrom(
        this.server
          .getMyValidation(account.serverUrl, account.publickey, sk)
          .pipe(timeout(SERVER_ANSWER_DELAY_MS)),
      );
    } catch (error) {
      console.error(error);
      this.snackBar.open(SYNC_IMPOSSIBLE_MESSAGE, 'Fermer', {
        duration: SYNC_IMPOSSIBLE_MESSAGE_DURATION_MS,
      });
      return null;
    }
  }

  private async adoptTheServerChainInstead(
    account: LoadedAccount,
    stored: MyValidationResponse,
  ): Promise<void> {
    const lostOperations = transactionsMissingFrom(stored.blocks, account.blockchain.export());
    await this.adoptTheServerChain(account, stored);
    this.snackBar.open(lostOperationsMessage(lostOperations), 'Fermer');
  }

  private async sendOrGiveUpTheDeviceChain(
    account: LoadedAccount,
    sk: string,
    stored: MyValidationResponse,
  ): Promise<void> {
    try {
      await firstValueFrom(this.backup.saveNow(account, sk));
    } catch (error) {
      console.error(error);
      if (lookupFailure(error as HttpErrorResponse) === 'unreachable') {
        this.snackBar.open(SYNC_IMPOSSIBLE_MESSAGE, 'Fermer', {
          duration: SYNC_IMPOSSIBLE_MESSAGE_DURATION_MS,
        });
        return;
      }
      await this.adoptTheServerChainInstead(account, stored);
    }
  }

  async syncWithServer(account: LoadedAccount, sk: string): Promise<void> {
    const stored = await this.storedOnTheServer(account, sk);
    if (stored === null) {
      return;
    }
    const deviceBlocks = account.blockchain.export();
    if (isTheSameChain(deviceBlocks, stored.blocks)) {
      return;
    }
    if (holdsEveryTransactionOf(stored.blocks, deviceBlocks)) {
      await this.adoptTheServerChain(account, stored);
      return;
    }
    if (holdsEveryTransactionOf(deviceBlocks, stored.blocks)) {
      await this.sendOrGiveUpTheDeviceChain(account, sk, stored);
      return;
    }
    await this.adoptTheServerChainInstead(account, stored);
  }

  async syncTheConnectedAccount(): Promise<void> {
    if (this.userService.isUnlocked()) {
      await this.syncWithServer(
        this.userService.getConnectedUser(),
        this.userService.getSecretKey(),
      );
    }
  }
}
