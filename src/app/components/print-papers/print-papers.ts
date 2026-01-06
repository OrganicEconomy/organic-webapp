import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';

import { jsPDF } from "jspdf";
import { QRCodeComponent } from 'angularx-qrcode';
import { environment } from '../../../../src/environments/environment';
import { Blockchain } from 'organic-money/src/index.js';

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
    MatSelectModule
  ],
  templateUrl: './print-papers.html',
  styleUrl: './print-papers.css',
})
export class PrintPapers {
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)
  user = this.userService.getConnectedUser()

  papercounts: Array<number> = new Array(34)
  total: number = 0
  max: number = 0
  papers: any = []
  canGenerate: boolean = false

  constructor(private router: Router) {
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
    this.canGenerate = this.total <= this.max
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
    doc.line(10 + 105 * col, 10 + 25 * row, 100 + 105 * col, 10 + 25 * row)
  }

  drawQRCode(paperId: string, doc: jsPDF, col: number, row: number) {
    const qrcode = document.getElementById('qrcode-' + paperId);
    if (qrcode) {
      if (qrcode.firstChild) {
        let imageData: any = this.getBase64Image(qrcode.firstChild.firstChild);
        doc.addImage(imageData, "JPG", 70 + 105 * col, 10 + 25 * row, 25, 25)
      }
    }
  }

  drawText(paper: any, doc: jsPDF, col: number, row: number) {
    //doc.text(paper.name, 10, 10)
    //doc.text(paper.emitter, 10, 10)
    //doc.text(paper.valid_date, 10, 10)
    //doc.text(paper.id, 10, 10)
    //doc.text(paper.amount, 10, 10)
    doc.setLineDashPattern([], 0)
    doc.rect(52 + col * 105, 23 + row * 25, 20, 10)
    doc.setFontSize(6)
    doc.text("Signature", 52 + col * 105, 25 + row * 25)
    doc.text("Emetteur :", 10 + col * 105, 14 + row * 25)
    doc.text("Valable jusqu'au", 10 + col * 105, 27 + row * 25)
    doc.text("Code :", 10 + col * 105, 30 + row * 25)
  }

  endOfRowReached(row: number) {
    return row === 11
  }

  endOfPageReached(col: number, row: number) {
    return row === 11 && col === 1
  }

  generatePapers() {
    for (let i = 0; i < this.papercounts.length; i++) {
      if (this.papercounts[i] > 0) {
        for (let j = 0; j < this.papercounts[i]; j++) {
          this.papers.push(this.user.blockchain.generatePaper(this.user.secretkey, i, environment.refPublicKey))
        }        
      }
    }
  }

  generatePDF() {
    this.generatePapers()

    const doc = new jsPDF();

    let row = 0;
    let col = 0;
    this.drawVerticalLine(doc)
    for (let paper of this.papers) {
      this.drawQRCode(paper.id, doc, col, row)
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
  }
}
