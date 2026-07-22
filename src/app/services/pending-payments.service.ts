import { Injectable, inject } from '@angular/core';
import { TransactionMaker } from 'organic-money/src/index.js';
import type { TxWire } from 'organic-protocol';
import { ConnectedUserService } from './connected-user.service';
import { ServerConnexionService } from './server-connection.service';
import { LocalDatabaseService } from './local-database.service';
import { LevelUpService } from './level-up.service';

@Injectable({ providedIn: 'root' })
export class PendingPaymentsService {
  private userService = inject(ConnectedUserService)
  private serverDB = inject(ServerConnexionService)
  private localDB = inject(LocalDatabaseService)
  private levelUp = inject(LevelUpService)

  tx_list: any[] = []
  dataSource: any[] = []

  refresh(): void {
    const user = this.userService.getConnectedUser()
    if (!user) return
    this.serverDB.getTransactionList(user.serverUrl, user.publickey, this.userService.getSecretKey()).subscribe({
      next: (data: TxWire[]) => this.updateDataSource(user, data),
      error: () => { /* offline or unreachable — list just stays as-is */ },
    })
  }

  private updateDataSource(user: any, data: TxWire[]) {
    const getContactName = (pk: string) => {
      const contact: any = user.contacts.find((contact: any) => contact.pk === pk)
      if (!contact) {
        return "..." + pk.slice(-15)
      }
      return contact.name
    }

    // Malformed entries are skipped rather than crashing the whole screen.
    this.tx_list = data
      .map((wireTx) => { try { return TransactionMaker.make(wireTx) } catch { return null } })
      .filter((tx: any) => tx !== null)

    this.dataSource = this.tx_list.map((tx: any) => ({
      date: tx.date.toLocaleDateString("fr-FR"),
      id: "..." + tx.signature.slice(-8),
      source: getContactName(tx.signer),
      amount: tx.money.length,
      hash: tx.signature,
    }))
  }

  cash(hash: string): void {
    const user = this.userService.getConnectedUser()
    const tx = this.tx_list.find((tx: any) => tx.signature === hash)
    if (!tx) return

    const oldLevel = user.blockchain.getLevel()
    user.blockchain.receivePay(tx)

    this.localDB.saveUser(user)
    this.serverDB.saveLastBlock(user, this.userService.getSecretKey())

    this.tx_list = this.tx_list.filter((t: any) => t.signature !== hash)
    this.dataSource = this.dataSource.filter((row: any) => row.hash !== hash)

    this.levelUp.celebrateIfLevelUp(oldLevel, user.blockchain.getLevel())
  }
}
