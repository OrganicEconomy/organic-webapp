import { TestBed } from '@angular/core/testing';

import { TabSessionService } from './tab-session.service';

const ALICE_PK = '02' + 'a1'.repeat(32);

describe('TabSessionService', () => {
  let service: TabSessionService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TabSessionService);
  });

  afterEach(() => sessionStorage.clear());

  describe('remember', () => {
    it('should keep the account and its unlocked key for this tab', () => {
      service.remember(ALICE_PK, 'alice-sk');

      expect(service.stored()).toEqual(jasmine.objectContaining({ publickey: ALICE_PK, secretKey: 'alice-sk' }));
    });

    it('should keep the app working, and say so, when this browser refuses the tab storage', () => {
      spyOn(Storage.prototype, 'setItem').and.throwError(new DOMException('denied', 'SecurityError'));
      spyOn(console, 'error');

      expect(() => service.remember(ALICE_PK, 'alice-sk')).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('forgetSecretKey', () => {
    it('should forget the unlocked key but keep the account of this tab', () => {
      service.remember(ALICE_PK, 'alice-sk');

      service.forgetSecretKey();

      expect(service.stored()).toEqual(jasmine.objectContaining({ publickey: ALICE_PK, secretKey: null }));
    });
  });

  describe('forget', () => {
    it('should forget the session of this tab entirely', () => {
      service.remember(ALICE_PK, 'alice-sk');

      service.forget();

      expect(service.stored()).toBeNull();
    });

    it('should say so when this browser refuses to forget the session', () => {
      spyOn(Storage.prototype, 'removeItem').and.throwError(new DOMException('denied', 'SecurityError'));
      spyOn(console, 'error');

      expect(() => service.forget()).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('noteActivity', () => {
    afterEach(() => jasmine.clock().uninstall());

    it('should push back the time of the last activity', () => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 10, 17, 9, 0));
      service.remember(ALICE_PK, 'alice-sk');
      jasmine.clock().mockDate(new Date(2026, 10, 17, 9, 10));

      service.noteActivity();

      expect(service.stored()?.lastActivityAt).toBe(new Date(2026, 10, 17, 9, 10).getTime());
    });
  });

  describe('stored', () => {
    it('should find no session, and say so, when this browser refuses the tab storage', () => {
      spyOn(Storage.prototype, 'getItem').and.throwError(new DOMException('denied', 'SecurityError'));
      spyOn(console, 'error');

      expect(service.stored()).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
