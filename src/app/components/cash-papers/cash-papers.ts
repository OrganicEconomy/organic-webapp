import { Component, inject, ViewChild } from '@angular/core';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { QrScanner } from '../qr-scanner/qr-scanner';
import { ConnectedUserService } from '../../services/connected-user.service';
import { Router, RouterLink } from '@angular/router';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LevelUpService } from '../../services/level-up.service';
import { BackupService } from '../../services/backup.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { decodeQr } from 'organic-protocol';
import { CitizenBlockchain, TransactionMaker } from 'organic-money/src/index.js';

@Component({
  selector: 'app-cash-papers',
  imports: [
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    QrScanner,
  ],
  templateUrl: './cash-papers.html',
  styleUrl: './cash-papers.css',
})
export class CashPapers {
  @ViewChild(MatTable) table: MatTable<any> | undefined;
  userService = inject(ConnectedUserService)
  serverDB = inject(ServerConnexionService)
  levelUp = inject(LevelUpService)
  backupService = inject(BackupService)
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
    let decoded
    try {
      decoded = decodeQr(result)
    } catch {
      this.displayMessage("QR code invalide.")
      return
    }
    if (decoded.type !== 'PP') {
      this.displayMessage("Ce QR n'est pas un billet.")
      return
    }

    let paper: any
    try {
      paper = TransactionMaker.make(decoded.payload.tx)
    } catch {
      this.displayMessage("QR code invalide.")
      return
    }

    const isDuplicate = this.paper_list.find((element: any) => element.signature === paper.signature)
    if (isDuplicate) { return }

    const query = this.serverDB.isPaperAlreadyCashed(this.user.serverUrl, paper.signature)
    query.subscribe({
      // isPaperAlreadyCashed only resolves (next) when the server has a record
      // of it — i.e. it WAS cashed. "Not cashed" is a 404 (Phase-1.md §6.5),
      // not a `false` value in a 200 response.
      next: () => {
        this.displayMessage("Ce billet a déjà été utilisé tantôt.")
      },
      error: (err: any) => {
        if (err.status === 404) {
          this.paper_list.push(paper)
          this.displayMessage("QR code scanné avec succès.")
          if (this.table) {
            this.table.renderRows();
          }
        } else {
          this.displayMessage("Impossible de vérifier ce billet pour le moment.")
        }
      }
    })
  }

  getContactName(pk: string) {
    if (!pk) return "-"
    const contact: any = this.user.contacts.find((contact: any) => contact.pk === pk)
    if (!contact) return "..." + pk.slice(-8)
    return contact.name
  }

  cashPapers() {
    if (this.userService.isReadOnlySession()) return

    const sk = this.userService.getSecretKey()
    const chainBeforeCashing = this.user.blockchain.export()
    const oldLevel = this.user.blockchain.getLevel()
    const failedPapers = []
    const okPapers: any[] = []
    for (let paper of this.paper_list) {
      try {
        this.user.blockchain.cashPaper(paper)
        okPapers.push(paper)
      } catch (err) {
        this.displayMessage("Le billet de " + paper.money.length + " dont la signature commence par '" + paper.signature.slice(0, 8) + "' n'a pas pu être encaissé (doublon ou invalide).")
        failedPapers.push(paper)
      }
    }

    this.paper_list = failedPapers
    if (okPapers.length > 0) {
      this.serverDB.signLastBlock(this.user, sk).subscribe({
        next: () => this.confirmCashing(okPapers, sk, oldLevel),
        error: (err: any) => this.cancelCashing(okPapers, chainBeforeCashing, err),
      })
    }
  }

  private confirmCashing(papers: any[], sk: string, oldLevel: number) {
    this.backupService.recordAutomatic(this.user, sk)
    for (const paper of papers) {
      this.displayMessage("Paf, j'encaisse " + paper.money.length)
    }
    this.levelUp.celebrateIfLevelUp(oldLevel, this.user.blockchain.getLevel())
  }

  private cancelCashing(papers: any[], chainBeforeCashing: any, err: any) {
    this.user.blockchain = new CitizenBlockchain(chainBeforeCashing)
    this.paper_list = this.paper_list.concat(papers)
    this.displayMessage(this.refusalMessage(err))
  }

  private refusalMessage(err: any): string {
    if (err.error?.code === 'ALREADY_CASHED') {
      return "Un de ces billets a déjà été encaissé par quelqu'un d'autre : rien n'a été encaissé."
    }
    if (err.status === 0) {
      return "Pas de connexion au serveur : les billets ne sont pas encaissés, réessaie une fois en ligne."
    }
    return "Le serveur a refusé ces billets (émetteur inconnu ou billet invalide) : rien n'a été encaissé."
  }

  displayMessage(message: string) {
    this._snackBar.open(message, 'Fermer', { duration: 8000 });
  }
}
