import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconButton } from '@angular/material/button';
import { ConnectedUserService } from '../../services/connected-user.service';
import { Blockchain } from 'organic-money/src/index.js';
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

  user: any
  displayedColumns: string[] = ['date', 'source', 'amount', 'cash']
  dataSource: any = []
  tx_list = []

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

  updateDataSource(data: any) {
    const getContactName = (pk: string) => {
      const contact: any = this.user.contacts.find((contact: any) => contact.pk === pk)
      if (!contact) {
        return "..." + pk.slice(-15)
      }
      return contact.name
    }
    this.tx_list = data.map((rawData: any) => rawData.tx)

    this.dataSource = this.tx_list.map((tx: any) => {
      return {
        date: Blockchain.intToDate(tx.date).toLocaleDateString("fr-FR"),
        id: "..." + tx.hash.slice(-8),
        source: getContactName(tx.source),
        amount: tx.money.length,
        hash: tx.hash
      }
    })
  }

  cash(hash: string) {
    const tx = this.tx_list.find((tx: any) => tx.hash === hash)
    if (!tx) return;

    this.user.blockchain.income(tx)
    this.localDB.saveUser(this.user)
    this.serverDB.saveLastBlock(this.user.serverUrl, this.user.blockchain.getMyPublicKey(), this.user.blockchain.lastblock, this.user.devicetoken, this.userService.getSecretKey())

    this.dataSource = this.dataSource.filter((row: any) => row.hash !== hash)
  }
}