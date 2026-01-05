import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { ConnectedUserService } from '../../services/connected-user.service';
import { Blockchain } from 'organic-money/src/index.js';

@Component({
  selector: 'app-transaction-list',
  imports: [
    MatTableModule
  ],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.css',
})

export class TransactionList {
  userService = inject(ConnectedUserService)

  user: any
  displayedColumns: string[] = ['date', 'type', 'source', 'target', 'amount']
  dataSource = []

  tx_types = {
    "0": "Initialisation",
    "1": "Création",
    "2": "Paiement",
    "3": "Engagement",
    "4": "Billet",
    "5": "Admin (set)",
    "6": "Acteur (set)",
    "7": "Payeur (set)"
  }

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }

    const tx_types: any = this.tx_types
    const getContactName = (pk: string) => {
      const contact: any = this.user.contacts.find((contact: any) => contact.pk === pk)
      if (!contact) {
        return pk.slice(-15)
      }
      return contact.name
    }
    
    this.dataSource = this.user.blockchain.getHistory()
      .map((tx: any) => {
        return {
          date: Blockchain.intToDate(tx.date).toLocaleDateString("fr-FR"),
          type: tx_types[tx.type],
          source: getContactName(tx.source),
          target: getContactName(tx.target),
          amount: tx.money.length
        }
      })
  }


}
