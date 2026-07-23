import { Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { ZXingScannerComponent, ZXingScannerModule } from '@zxing/ngx-scanner';

/**
 * Wraps <zxing-scanner> with the loading/error feedback it doesn't provide
 * on its own — otherwise camera startup (which can take a while, or fail
 * silently) just shows a blank rectangle with no explanation.
 *
 * The library's own signals (camerasNotFound, permissionResponse, scanError)
 * have proven unreliable on some mobile browsers — confirmed firing an error
 * while the <video> element already showed a live camera feed. Rather than
 * chasing each event, the actual <video> element is checked directly and
 * trusted over whatever the library reports.
 */
@Component({
  selector: 'app-qr-scanner',
  imports: [ZXingScannerModule],
  templateUrl: './qr-scanner.html',
  styleUrl: './qr-scanner.css',
})
export class QrScanner implements OnDestroy {
  private elementRef = inject(ElementRef<HTMLElement>);
  @ViewChild(ZXingScannerComponent) private scanner?: ZXingScannerComponent;
  @Output() scanSuccess = new EventEmitter<string>();

  loading = true;
  errorMessage: string | null = null;
  scannerVisible = true;

  private static readonly AUTO_RETRY_DELAY_MS = 700;
  private static readonly MANUAL_RETRY_DELAY_MS = 800;
  private static readonly LIVE_VIDEO_POLL_INTERVAL_MS = 300;
  private static readonly LIVE_VIDEO_POLL_MAX_ATTEMPTS = 10;
  private autoRetried = false;

  onScanSuccess(result: string): void {
    this.scanSuccess.emit(result);
  }

  onAutostarting(state: boolean): void {
    this.loading = !!state;
  }

  onCamerasNotFound(): void {
    if (this.hasLiveVideo()) {
      // Confirmed in the wild: this can fire while the camera is already
      // showing a live feed. Trust the screen, not the library — don't tear
      // anything down over a stale signal.
      this.loading = false;
      return;
    }
    // A full fresh cycle (tear down and recreate, re-running
    // askForPermission() from scratch) has proven more reliable than a
    // same-instance re-enumeration on devices where this fires. Try that
    // once, silently, before showing an error.
    if (!this.autoRetried) {
      this.autoRetried = true;
      this.recreateScanner(QrScanner.AUTO_RETRY_DELAY_MS);
      return;
    }
    this.fail('Aucune caméra détectée sur cet appareil.');
  }

  onPermissionResponse(granted: boolean): void {
    if (!granted) {
      this.fail("Accès à la caméra refusé — autorise-le dans les réglages du navigateur.");
    }
  }

  onScanError(err: Error): void {
    this.fail("Erreur du scanner : " + (err?.message || 'inconnue'));
  }

  retry(): void {
    this.errorMessage = null;
    this.loading = true;
    this.autoRetried = false;
    this.recreateScanner(QrScanner.MANUAL_RETRY_DELAY_MS);
  }

  private fail(message: string): void {
    this.loading = false;
    this.errorMessage = message;
    // The library said it failed, but that has proven unreliable — keep
    // checking the actual video element for a short while in case it starts
    // showing a real feed anyway, and silently clear the error if it does.
    this.pollForLiveVideo();
  }

  private pollForLiveVideo(attemptsLeft = QrScanner.LIVE_VIDEO_POLL_MAX_ATTEMPTS): void {
    if (this.hasLiveVideo()) {
      this.loading = false;
      this.errorMessage = null;
      return;
    }
    if (attemptsLeft <= 0) {
      return;
    }
    setTimeout(() => this.pollForLiveVideo(attemptsLeft - 1), QrScanner.LIVE_VIDEO_POLL_INTERVAL_MS);
  }

  private hasLiveVideo(): boolean {
    const video = this.elementRef.nativeElement.querySelector('video');
    return !!video && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0;
  }

  private recreateScanner(delayMs: number): void {
    this.scannerVisible = false;
    setTimeout(() => { this.scannerVisible = true; }, delayMs);
  }

  ngOnDestroy(): void {
    try {
      this.scanner?.scanStop();
    } catch {
      // Best-effort camera release — nothing more we can do if it fails.
    }
  }
}
