import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { SessionLockService } from './session-lock.service';
import { ConnectedUserService } from './connected-user.service';
import { TabSessionService } from './tab-session.service';
import { LockDialog } from '../components/lock-dialog/lock-dialog';

const ALICE_PK = '02' + 'a1'.repeat(32);

describe('SessionLockService', () => {
  let service: SessionLockService;
  let locked: boolean;
  let userServiceStub: { isLocked: () => boolean; lock: jasmine.Spy; getConnectedUser: () => unknown };
  let dialogSpy: jasmine.SpyObj<Pick<MatDialog, 'open' | 'getDialogById'>>;
  let tabSession: TabSessionService;

  beforeEach(() => {
    sessionStorage.clear();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 10, 17, 9, 0));
    locked = false;
    userServiceStub = {
      isLocked: () => locked,
      lock: jasmine.createSpy('lock').and.callFake(() => (locked = true)),
      getConnectedUser: () => ({ publickey: ALICE_PK }),
    };
    dialogSpy = jasmine.createSpyObj('MatDialog', ['open', 'getDialogById']);
    TestBed.configureTestingModule({
      providers: [
        { provide: ConnectedUserService, useValue: userServiceStub },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    });
    tabSession = TestBed.inject(TabSessionService);
    tabSession.remember(ALICE_PK, 'alice-sk');
    service = TestBed.inject(SessionLockService);
  });

  afterEach(() => {
    service.stop();
    jasmine.clock().uninstall();
    sessionStorage.clear();
  });

  describe('start', () => {
    it('should lock and ask for the password after 15 minutes without activity', () => {
      service.start();

      jasmine.clock().tick(15 * 60_000);

      expect(userServiceStub.lock).toHaveBeenCalled();
      expect(dialogSpy.open).toHaveBeenCalledWith(LockDialog, jasmine.objectContaining({ disableClose: true }));
    });

    it('should ask for the password at once when the session was resumed locked', () => {
      locked = true;

      service.start();

      expect(dialogSpy.open).toHaveBeenCalledWith(LockDialog, jasmine.objectContaining({ disableClose: true }));
    });

    it('should lock at once when the app comes back after a long time in the background', () => {
      service.start();
      jasmine.clock().mockDate(new Date(2026, 10, 17, 9, 20));

      document.dispatchEvent(new Event('visibilitychange'));

      expect(userServiceStub.lock).toHaveBeenCalled();
    });

    it('should push the lock back each time the citizen does something', () => {
      service.start();
      jasmine.clock().tick(10 * 60_000);

      document.dispatchEvent(new PointerEvent('pointerdown'));
      jasmine.clock().tick(10 * 60_000);

      expect(userServiceStub.lock).not.toHaveBeenCalled();
    });

    it('should not lock before 15 minutes without activity', () => {
      service.start();

      jasmine.clock().tick(14 * 60_000 + 30_000);

      expect(userServiceStub.lock).not.toHaveBeenCalled();
    });
  });

  describe('askForPassword', () => {
    it('should not open a second lock dialog over the first one', () => {
      dialogSpy.getDialogById.and.returnValue({} as any);

      service.askForPassword();

      expect(dialogSpy.open).not.toHaveBeenCalled();
    });
  });
});
