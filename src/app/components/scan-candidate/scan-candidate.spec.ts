import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { encodeValidationQr, encodeContactQr } from 'organic-protocol';

import { ScanCandidate } from './scan-candidate';

describe('ScanCandidate', () => {
  let component: ScanCandidate;
  let fixture: ComponentFixture<ScanCandidate>;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ScanCandidate],
      providers: [provideRouter([])],
    });

    fixture = TestBed.createComponent(ScanCandidate);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('scanSuccessHandler', () => {
    it('should navigate to the candidate\'s detail screen from a scanned OM1:BR QR', () => {
      const qr = encodeValidationQr({ pk: 'camille-pk', url: 'https://trifouillis.fr', n: 'Camille' });

      component.scanSuccessHandler(qr);

      expect(router.navigate).toHaveBeenCalledWith(['/validations', 'camille-pk']);
    });

    it('should show an error for a QR of another type, without crashing', () => {
      const contactQr = encodeContactQr({ pk: 'alice-pk', url: 'https://trifouillis.fr', n: 'Alice' });

      expect(() => component.scanSuccessHandler(contactQr)).not.toThrow();

      expect(component.scanError).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should show an error for text that is not an OM QR at all, without crashing', () => {
      expect(() => component.scanSuccessHandler('not a qr at all')).not.toThrow();

      expect(component.scanError).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
