import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarcodeFormat, BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { Exception, Result } from '@zxing/library';

type DecodeContinuouslyCallback = Parameters<BrowserQRCodeReader['decodeFromConstraints']>[2];

import { QR_CODE_READER, QrScanner } from './qr-scanner';

describe('QrScanner', () => {
  let component: QrScanner;
  let fixture: ComponentFixture<QrScanner>;
  let reader: jasmine.SpyObj<BrowserQRCodeReader>;
  let controls: jasmine.SpyObj<IScannerControls>;

  function previewVideo(): HTMLVideoElement {
    return fixture.nativeElement.querySelector('video');
  }

  function decode(result: Result | undefined, error?: Exception): void {
    const onDecode: DecodeContinuouslyCallback = reader.decodeFromConstraints.calls.mostRecent().args[2];
    onDecode(result, error, controls);
  }

  async function openCameraFailingWith(errorName: string): Promise<void> {
    reader.decodeFromConstraints.and.returnValue(
      Promise.reject(new DOMException('Starting videoinput failed', errorName)),
    );
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    controls = jasmine.createSpyObj<IScannerControls>('controls', ['stop']);
    reader = jasmine.createSpyObj<BrowserQRCodeReader>('reader', ['decodeFromConstraints']);
    reader.decodeFromConstraints.and.returnValue(Promise.resolve(controls));

    TestBed.configureTestingModule({
      imports: [QrScanner],
      providers: [{ provide: QR_CODE_READER, useValue: reader }],
    });

    fixture = TestBed.createComponent(QrScanner);
    component = fixture.componentInstance;
  });

  describe('ngAfterViewInit', () => {
    it('should open the rear camera into the preview video', () => {
      fixture.detectChanges();

      expect(reader.decodeFromConstraints).toHaveBeenCalledOnceWith(
        { video: { facingMode: 'environment' } },
        previewVideo(),
        jasmine.any(Function),
      );
    });

    it('should stop loading once the camera is open', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.loading).toBeFalse();
    });

    it('should emit the text of every decoded QR code', () => {
      const scanned: string[] = [];
      component.scanSuccess.subscribe((text) => scanned.push(text));
      fixture.detectChanges();

      decode(new Result('some-qr-payload', null as any, 0, [], BarcodeFormat.QR_CODE));

      expect(scanned).toEqual(['some-qr-payload']);
    });

    it('should explain that camera access was refused', async () => {
      await openCameraFailingWith('NotAllowedError');

      expect(component.loading).toBeFalse();
      expect(component.errorMessage).toBe(
        'Accès à la caméra refusé — autorise-le dans les réglages du navigateur.',
      );
    });

    it('should explain that this device has no camera', async () => {
      await openCameraFailingWith('NotFoundError');

      expect(component.errorMessage).toBe('Aucune caméra détectée sur cet appareil.');
    });

    it("should show the browser's reason for any other failure", async () => {
      await openCameraFailingWith('NotReadableError');

      expect(component.errorMessage).toBe(
        "Impossible d'ouvrir la caméra : Starting videoinput failed",
      );
    });
  });

  describe('retry', () => {
    it('should open the rear camera again, showing loading instead of the error', async () => {
      await openCameraFailingWith('NotReadableError');
      reader.decodeFromConstraints.and.returnValue(new Promise(() => {}));

      component.retry();

      expect(reader.decodeFromConstraints).toHaveBeenCalledTimes(2);
      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeTrue();
    });
  });

  describe('ngOnDestroy', () => {
    it('should release the open camera', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.destroy();

      expect(controls.stop).toHaveBeenCalled();
    });

    it('should release the camera that finishes opening after the scanner is gone', async () => {
      let finishOpening!: (controls: IScannerControls) => void;
      reader.decodeFromConstraints.and.returnValue(new Promise((resolve) => (finishOpening = resolve)));
      fixture.detectChanges();

      fixture.destroy();
      finishOpening(controls);
      await fixture.whenStable();

      expect(controls.stop).toHaveBeenCalled();
    });
  });
});
