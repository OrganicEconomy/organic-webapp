import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { QrScanner } from './qr-scanner';

describe('QrScanner', () => {
  let component: QrScanner;
  let fixture: ComponentFixture<QrScanner>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QrScanner],
    });

    fixture = TestBed.createComponent(QrScanner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in a loading state', () => {
    expect(component.loading).toBeTrue();
    expect(component.errorMessage).toBeNull();
  });

  it('autostarting(false) should clear the loading state', () => {
    component.onAutostarting(false);
    expect(component.loading).toBeFalse();
  });

  it('permissionResponse(false) should show an error', () => {
    component.onPermissionResponse(false);
    expect(component.errorMessage).toContain('caméra');
  });

  it('permissionResponse(true) should not show an error', () => {
    component.onPermissionResponse(true);
    expect(component.errorMessage).toBeNull();
  });

  it('scanError should show an error message', () => {
    component.onScanError(new Error('device disconnected'));
    expect(component.errorMessage).toContain('device disconnected');
  });

  it('a successful scan should forward the result via the scanSuccess output', () => {
    const results: string[] = [];
    component.scanSuccess.subscribe((r) => results.push(r));

    component.onScanSuccess('some-qr-payload');

    expect(results).toEqual(['some-qr-payload']);
  });

  it('ngOnDestroy should stop the underlying scanner as a best-effort camera release', () => {
    const scanner = (component as any).scanner;
    expect(scanner).toBeTruthy();
    spyOn(scanner, 'scanStop');

    component.ngOnDestroy();

    expect(scanner.scanStop).toHaveBeenCalled();
  });

  it('ngOnDestroy should not throw even if the underlying scanner is not ready', () => {
    (component as any).scanner = undefined;
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  describe('camerasNotFound', () => {
    it('should not show an error on the first occurrence — silently recreates the scanner instead', fakeAsync(() => {
      component.onCamerasNotFound();

      expect(component.errorMessage).toBeNull();
      tick(1000);
    }));

    it('should tear down and recreate the scanner element on the first occurrence', fakeAsync(() => {
      component.onCamerasNotFound();
      expect(component.scannerVisible).toBeFalse();

      tick(1000);

      expect(component.scannerVisible).toBeTrue();
    }));

    it('should show the error only if a second occurrence happens after the silent retry', fakeAsync(() => {
      component.onCamerasNotFound();
      tick(1000);

      // The recreated scanner instance also failed to find a camera.
      component.onCamerasNotFound();

      expect(component.loading).toBeFalse();
      expect(component.errorMessage).toContain('caméra');
    }));
  });

  describe('live video as source of truth (the library\'s own events have proven unreliable — confirmed firing camerasNotFound while a live feed was already on screen)', () => {
    function setVideoLive(live: boolean): void {
      const video: HTMLVideoElement | null = fixture.nativeElement.querySelector('video');
      if (!video) throw new Error('test setup: no <video> element in the DOM');
      Object.defineProperty(video, 'readyState', { value: live ? 2 : 0, configurable: true });
      Object.defineProperty(video, 'videoWidth', { value: live ? 640 : 0, configurable: true });
    }

    it('camerasNotFound should be ignored — no retry, no error — if the video is already live', () => {
      setVideoLive(true);

      component.onCamerasNotFound();

      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeFalse();
      expect(component.scannerVisible).toBeTrue();
    });

    it('should clear an already-shown error automatically once the video becomes live shortly after', fakeAsync(() => {
      component.onPermissionResponse(false);
      expect(component.errorMessage).toBeTruthy();

      setVideoLive(true);
      tick(1000);

      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeFalse();
    }));

    it('should give up and leave the error showing if the video never becomes live', fakeAsync(() => {
      component.onPermissionResponse(false);

      tick(5000);

      expect(component.errorMessage).toBeTruthy();
    }));
  });

  describe('retry()', () => {
    it('should clear the error and show loading again immediately', () => {
      component.onPermissionResponse(false);

      component.retry();

      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeTrue();
    });

    it('should not recreate the scanner element immediately — gives the camera a moment before a full re-init', () => {
      component.onPermissionResponse(false);

      component.retry();

      expect(component.scannerVisible).toBeFalse();
    });

    it('should recreate the scanner element after a short cooldown', fakeAsync(() => {
      component.onPermissionResponse(false);

      component.retry();
      tick(1000);

      expect(component.scannerVisible).toBeTrue();
    }));
  });
});
