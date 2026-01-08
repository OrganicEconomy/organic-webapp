import { Component, inject, ViewChild } from '@angular/core';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';

import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { MatCardContent, MatCard, MatCardActions, MatCardSubtitle, MatCardHeader, MatCardTitle } from "@angular/material/card";
import { ConnectedUserService } from '../../services/connected-user.service';
import { Router } from '@angular/router';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { MatList, MatListItem } from "@angular/material/list";
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-cash-papers',
  imports: [
    MatTableModule,
    MatButtonModule,
    ZXingScannerModule,
    MatCardContent,
    MatCard,
    MatCardActions,
    MatCardSubtitle,
    MatCardHeader,
    MatCardTitle,
],
  templateUrl: './cash-papers.html',
  styleUrl: './cash-papers.css',
})
export class CashPapers {
  @ViewChild(MatTable) table: MatTable<any> | undefined;
  userService = inject(ConnectedUserService)
  serverDB = inject(ServerConnexionService)
  localDB = inject(LocalDatabaseService)
  private _snackBar = inject(MatSnackBar);

  user: any
  displayedColumns: string[] = ['id', 'date', 'emitter', 'amount']
  paper_list: any = []

  constructor(private router: Router) {
    this.user = this.userService.getConnectedUser()
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
  }

  scanSuccessHandler(result: string) {
    let paper: any
    try {
      paper = JSON.parse(result)
    } catch {
      this.displayMessage("QR code invalide.")
      return
    }
    if (!paper.hash) {
      this.displayMessage("QR code invalide.")
      return
    }

    const isDuplicate = this.paper_list.find((element: any) => element.hash === paper.hash)
    if (isDuplicate) { return }

    this.paper_list.push(paper)
    this.displayMessage("QR code scanné avec succès.")
    if (this.table) {
      this.table.renderRows();
    }
  }

  getContactName(pk: string) {
    if (!pk) {
      return "-"
    }
    const contact: any = this.user.contacts.find((contact: any) => contact.pk === pk)
    if (!contact) {
      return pk.slice(-15)
    }
    return contact.name
  }

  cashPapers() {
    const failedPapers = []
    for (let paper of this.paper_list) {
      try {
        this.user.blockchain.cashPaper(paper)
        this.displayMessage("Paf, j'encaisse " + paper.money.length)
      } catch (err) {
        this.displayMessage("Le billet de " + paper.money.length + "— dont le code commence pas '" + paper.hash.slice(0, 8) + "' n'a pas pu être encaissé (doublons ou invalide).")
        failedPapers.push(paper)
      }
    }

    this.localDB.saveUser(this.user)
    this.serverDB.saveLastBlock(this.user.blockchain.getMyPublicKey(), this.user.blockchain.lastblock)

    this.paper_list = failedPapers
  }

  displayMessage(message: string) {
    this._snackBar.open(message, 'Fermer', { duration: 8000 });
  }
}
