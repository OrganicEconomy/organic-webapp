import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  InjectionToken,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { Result } from '@zxing/library';

export const QR_CODE_READER = new InjectionToken<BrowserQRCodeReader>('QR_CODE_READER', {
  providedIn: 'root',
  factory: () => new BrowserQRCodeReader(),
});

const REAR_CAMERA: MediaStreamConstraints = { video: { facingMode: 'environment' } };

@Component({
  selector: 'app-qr-scanner',
  templateUrl: './qr-scanner.html',
  styleUrl: './qr-scanner.css',
})
export class QrScanner implements AfterViewInit, OnDestroy {
  private reader = inject(QR_CODE_READER);
  @ViewChild('preview') private preview!: ElementRef<HTMLVideoElement>;
  @Output() scanSuccess = new EventEmitter<string>();

  loading = true;
  errorMessage: string | null = null;
  private camera?: IScannerControls;
  private destroyed = false;

  ngAfterViewInit(): void {
    this.openCamera();
  }

  retry(): void {
    this.errorMessage = null;
    this.loading = true;
    this.openCamera();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.releaseCamera();
  }

  private async openCamera(): Promise<void> {
    try {
      this.camera = await this.scanRearCamera();
      this.releaseCameraIfAlreadyDestroyed();
    } catch (error) {
      this.errorMessage = this.explain(error);
    }
    this.loading = false;
  }

  private scanRearCamera(): Promise<IScannerControls> {
    return this.reader.decodeFromConstraints(REAR_CAMERA, this.preview.nativeElement, (result) =>
      this.emitScanned(result),
    );
  }

  private emitScanned(result: Result | undefined): void {
    if (result) {
      this.scanSuccess.emit(result.getText());
    }
  }

  private releaseCameraIfAlreadyDestroyed(): void {
    if (this.destroyed) {
      this.releaseCamera();
    }
  }

  private releaseCamera(): void {
    this.camera?.stop();
  }

  private explain(error: unknown): string {
    if (this.isNamed(error, 'NotAllowedError')) {
      return 'Accès à la caméra refusé — autorise-le dans les réglages du navigateur.';
    }
    if (this.isNamed(error, 'NotFoundError')) {
      return 'Aucune caméra détectée sur cet appareil.';
    }
    return "Impossible d'ouvrir la caméra : " + (error as Error)?.message;
  }

  private isNamed(error: unknown, name: string): boolean {
    return error instanceof Error && error.name === name;
  }
}
