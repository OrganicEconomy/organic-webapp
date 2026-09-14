import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { QrScanner } from '../qr-scanner/qr-scanner';
import { decodeQr } from 'organic-protocol';

@Component({
  selector: 'app-scan-candidate',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    QrScanner,
  ],
  templateUrl: './scan-candidate.html',
  styleUrl: './scan-candidate.css',
})
export class ScanCandidate {
  scanError = '';

  constructor(private router: Router) { }

  scanSuccessHandler(result: string): void {
    let decoded
    try {
      decoded = decodeQr(result)
    } catch {
      this.scanError = "QR code invalide."
      return
    }
    if (decoded.type !== 'BR') {
      this.scanError = "Ce QR ne correspond pas à un candidat."
      return
    }

    this.router.navigate(['/validations', decoded.payload.pk])
  }
}
