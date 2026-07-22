import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConnectedUserService } from '../../services/connected-user.service';
import { TransactionMaker } from 'organic-money/src/index.js';
import type { TxWire } from 'organic-protocol';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LocalDatabaseService } from '../../services/local-database.service';

@Component({
  selector: 'app-cash-payment',
  imports: [
    MatTableModule,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './cash-payment.html',
  styleUrl: './cash-payment.css',
})
export class CashPayment {
  userService = inject(ConnectedUserService)
  serverDB = inject(ServerConnexionService)
  localDB = inject(LocalDatabaseService)
  private _snackBar = inject(MatSnackBar)

  user: any
  displayedColumns: string[] = ['date', 'source', 'amount', 'cash']
  dataSource: any = []
  tx_list: any[] = []

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.updateList()
  }

  updateList() {
    const query = this.serverDB.getTransactionList(this.user.serverUrl, this.user.publickey, this.userService.getSecretKey())
    query.subscribe({
      next: data => {
        this.updateDataSource(data)
      },
      error: err => {
        console.log("Something went wrong")
      }
    })
  }

  updateDataSource(data: TxWire[]) {
    const getContactName = (pk: string) => {
      const contact: any = this.user.contacts.find((contact: any) => contact.pk === pk)
      if (!contact) {
        return "..." + pk.slice(-15)
      }
      return contact.name
    }

    // Malformed entries are skipped rather than crashing the whole screen.
    this.tx_list = data
      .map((wireTx) => { try { return TransactionMaker.make(wireTx) } catch { return null } })
      .filter((tx: any) => tx !== null)

    this.dataSource = this.tx_list.map((tx: any) => {
      return {
        date: tx.date.toLocaleDateString("fr-FR"),
        id: "..." + tx.signature.slice(-8),
        source: getContactName(tx.signer),
        amount: tx.money.length,
        hash: tx.signature
      }
    })
  }

  cash(hash: string) {
    const tx = this.tx_list.find((tx: any) => tx.signature === hash)
    if (!tx) return;

    this.user.blockchain.receivePay(tx)
    const leveledUp = this.user.blockchain.hasLevelUpOnLastTx()

    this.localDB.saveUser(this.user)
    this.serverDB.saveLastBlock(this.user, this.userService.getSecretKey())

    this.dataSource = this.dataSource.filter((row: any) => row.hash !== hash)

    if (leveledUp) {
      this._snackBar.open('Niveau supérieur !', 'OK', { duration: 3000 })
    }
  }
}