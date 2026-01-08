import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { MatInputModule } from '@angular/material/input';
import {MatCheckboxModule} from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';

import { jsPDF } from "jspdf";
import { QRCodeComponent } from 'angularx-qrcode';
import { environment } from '../../../../src/environments/environment';
import { Blockchain } from 'organic-money/src/index.js';
import { ServerConnexionService } from '../../services/server-connection.service';

export interface DialogData {
  waitFunction: any
}

const ROW_HEIGHT: number = 33;
const PAPER_PER_COL: number = 8;
const COL_PER_PAGE: number = 2;
@Component({
  selector: 'app-print-papers',
  imports: [
    QRCodeComponent,
    RouterLink,
    MatButtonModule,
    MatProgressBarModule,
    MatCardModule,
    MatDividerModule,
    MatListModule,
    MatSelectModule,
    MatInputModule,
    MatSelectModule,
    MatInputModule,
    MatCardModule,
    FormsModule,
    MatCheckboxModule
  ],
  templateUrl: './print-papers.html',
  styleUrl: './print-papers.css',
})
export class PrintPapers {
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)
  serverDB = inject(ServerConnexionService)
  user = this.userService.getConnectedUser()
  dialog = inject(Dialog);

  papercounts: Array<number> = new Array(34)
  total: number = 0
  max: number = 0
  papers: any = []
  canGenerate: boolean = false
  validated: boolean = false

  constructor(private router: Router, private cdRef: ChangeDetectorRef) {
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.max = this.user.blockchain.getAvailableMoneyAmount()
  }

  selectedValue(event: MatSelectChange, amount: number) {
    this.papercounts[amount] = Number(event.value)

    this.total = this.papercounts.reduce((total, current, index) => {
      return total + index * current;
    }, 0);
    this.validationCheck()
  }

  validationCheck() {
    this.canGenerate = (this.validated) && (this.total > 0) && (!this.isTooMuch())
  }

  isTooMuch() {
    return this.total > this.max
  }

  getBase64Image(img: any) {
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");
    if (!ctx) { return }
    ctx.drawImage(img, 0, 0);
    var dataURL = canvas.toDataURL("image/png");
    return dataURL;
  }

  drawVerticalLine(doc: jsPDF) {
    doc.setLineDashPattern([2.5], 0)
    doc.line(105, 10, 105, 287)
  }

  drawHorizontalLine(doc: jsPDF, col: number, row: number) {
    doc.setLineDashPattern([2.5], 0)
    doc.line(10 + 105 * col, 10 + ROW_HEIGHT * row, 100 + 105 * col, 10 + ROW_HEIGHT * row)
  }

  drawQRCode(paper: any, doc: jsPDF, col: number, row: number) {
    const qrcode = document.getElementById('qrcode-' + paper.hash);
    if (qrcode) {
      if (qrcode.firstChild) {
        if (qrcode.firstChild.firstChild) {
          let imageData: any = this.getBase64Image(qrcode.firstChild.firstChild);
          doc.addImage(imageData, "JPG", 67 + 105 * col, 10 + ROW_HEIGHT * row, 32, 32)
        }
      }
    }
  }

  getPaperTx(paper: any) {
    return JSON.stringify(paper)
  }

  drawText(paper: any, doc: jsPDF, col: number, row: number) {
    // Emitter informations
    doc.setFontSize(8)
    doc.text("Emetteur :", 10 + col * 105, 15 + row * ROW_HEIGHT)
    doc.setFontSize(12)
    doc.text(this.user.name.slice(0, 26), 24 + col * 105, 15 + row * ROW_HEIGHT)
    doc.setFontSize(5)
    doc.text("("+paper.signer.slice(0, 32), 10 + col * 105, 18 + row * ROW_HEIGHT)
    doc.text(paper.signer.slice(32, 66)+")", 10 + col * 105, 20 + row * ROW_HEIGHT)
    
    // Date
    doc.setFontSize(6)
    doc.text("Valable jusqu'au", 10 + col * 105, 24 + row * ROW_HEIGHT)
    doc.setFontSize(10)
    let d = new Date(Blockchain.intToDate(paper.date))
    d.setDate(d.getDate() + 30);
    doc.text(d.toLocaleDateString("fr-FR"), 10 + col * 105, 28 + row * ROW_HEIGHT)
    
    // Amount
    doc.setFontSize(20)
    doc.text(""+paper.money.length+"—", 46 + col * 105, 20 + row * ROW_HEIGHT)

    // Signature zone
    doc.setFontSize(6)
    doc.text("Signature", 45 + col * 105, 25 + row * ROW_HEIGHT)
    doc.setLineDashPattern([], 0)
    doc.rect(45 + col * 105, 23 + row * ROW_HEIGHT, 20, 10)

    // ID (=hash)
    doc.setFontSize(5)
    doc.text("Code :", 10 + col * 105, 34 + row * ROW_HEIGHT)
    doc.text(paper.hash.slice(0, 47), 10 + col * 105, 36 + row * ROW_HEIGHT)
    doc.text(paper.hash.slice(47, 2*47), 10 + col * 105, 38 + row * ROW_HEIGHT)
    doc.text(paper.hash.slice(2*47, -1), 10 + col * 105, 40 + row * ROW_HEIGHT)
  }

  endOfRowReached(row: number) {
    return row >= PAPER_PER_COL
  }

  endOfPageReached(col: number, row: number) {
    return this.endOfRowReached(row) && col >= COL_PER_PAGE - 1
  }

  openDialog() {
    const dialogRef = this.dialog.open(DialogDownload, {
      width: '250px',
      disableClose: true,
      data: {}
    });

    dialogRef.closed.subscribe(result => {
      this.generatePDF()
    });
  }

  generatePapers() {
    for (let i = 0; i < this.papercounts.length; i++) {
      if (this.papercounts[i] > 0) {
        for (let j = 0; j < this.papercounts[i]; j++) {
          this.papers.push(this.user.blockchain.generatePaper(this.user.secretkey, i, environment.refPublicKey))
        }
      }
    }

    this.localDB.saveUser(this.user)
    this.serverDB.saveLastBlock(this.user.blockchain.getMyPublicKey(), this.user.blockchain.lastblock)
    this.openDialog()
  }

  generatePDF() {
    const doc = new jsPDF();

    let row = 0;
    let col = 0;
    this.drawVerticalLine(doc)
    for (let paper of this.papers) {
      this.drawQRCode(paper, doc, col, row)
      this.drawText(paper, doc, col, row)
      this.drawHorizontalLine(doc, col, row)
      row++
      if (this.endOfPageReached(col, row)) {
        this.drawHorizontalLine(doc, col, row)
        doc.addPage()
        col = 0
        row = 0
      }
      if (this.endOfRowReached(row)) {
        this.drawHorizontalLine(doc, col, row)
        col = 1
        row = 0
      }
    }
    this.drawHorizontalLine(doc, col, row)

    doc.save('FirstPdf.pdf');
    this.router.navigate(['/home']);
  }

}

@Component({
  selector: 'dialog-download',
  templateUrl: 'dialog-download.html',
  styleUrl: 'dialog-download.css',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatProgressSpinnerModule
],
})
export class DialogDownload {
  dialogRef = inject<DialogRef<string>>(DialogRef<string>);

  isReady = false

  constructor() {
    new Promise(resolve => setTimeout(resolve, 1000))
      .then(() => { 
        this.isReady = true
        console.log("je suis prête mon gloubinours")
      })
  }
}
