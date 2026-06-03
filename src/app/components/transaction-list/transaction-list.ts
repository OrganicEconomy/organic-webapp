import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { ConnectedUserService } from '../../services/connected-user.service';

@Component({
  selector: 'app-transaction-list',
  imports: [
    MatTableModule,
    MatCardModule,
  ],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.css',
})
export class TransactionList {
  userService = inject(ConnectedUserService)

  user: any
  displayedColumns: string[] = ['date', 'type', 'source', 'target', 'amount']
  dataSource: any[] = []

  tx_types: Record<string, string> = {
    "1": "Initialisation",
    "2": "Création",
    "3": "Paiement",
    "4": "Engagement",
    "5": "Billet",
    "6": "Assignation Admin",
    "7": "Assignation Acteur",
    "8": "Assignation Payeur",
    "9": "Suppression Admin",
    "10": "Suppression Acteur",
    "11": "Suppression Payeur"
  }

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }

    const getContactName = (pk: string) => {
      if (!pk) return "-"
      if (pk === this.user.blockchain.getMyPublicKey()) {
        return "Moi"
      }
      const contact: any = this.user.contacts.find((c: any) => c.pk === pk)
      return contact ? contact.name : "..." + pk.slice(-8)
    }

    this.dataSource = this.user.blockchain.getHistory()
      .map((tx: any) => ({
        date: tx.date.toLocaleDateString("fr-FR"),
        type: this.tx_types[tx.type] ?? tx.type,
        source: getContactName(tx.source),
        target: getContactName(tx.target),
        amount: tx.money.length
      }))
  }
}