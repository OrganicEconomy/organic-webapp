import { DestroyRef, Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConnectedUserService } from './connected-user.service';
import { TabSessionService, hasBeenIdleForTooLong } from './tab-session.service';
import { LockDialog } from '../components/lock-dialog/lock-dialog';

const IDLENESS_CHECK_INTERVAL_MS = 30_000;
const ACTIVITY_COPY_INTERVAL_MS = 30_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown'];
const LOCK_DIALOG_ID = 'session-lock';

@Injectable({ providedIn: 'root' })
export class SessionLockService {
  private userService = inject(ConnectedUserService);
  private tabSession = inject(TabSessionService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private lastActivityAt = Date.now();
  private lastActivityCopiedAt = 0;

  private hasCopiedActivityRecently(): boolean {
    return Date.now() - this.lastActivityCopiedAt < ACTIVITY_COPY_INTERVAL_MS;
  }

  private noteActivity = (): void => {
    this.lastActivityAt = Date.now();
    if (this.hasCopiedActivityRecently()) {
      return;
    }
    this.lastActivityCopiedAt = Date.now();
    this.tabSession.noteActivity();
  };

  private lockIfIdleForTooLong(): void {
    if (this.userService.isUnlocked() && hasBeenIdleForTooLong(this.lastActivityAt)) {
      this.userService.lock();
    }
    if (this.userService.isLocked()) {
      this.askForPassword();
    }
  }

  askForPassword(): void {
    if (this.dialog.getDialogById(LOCK_DIALOG_ID)) {
      return;
    }
    this.dialog.open(LockDialog, {
      id: LOCK_DIALOG_ID,
      disableClose: true,
      closeOnNavigation: false,
      width: '320px',
    });
  }

  private lockOnReturnIfIdleForTooLong = (): void => {
    if (document.visibilityState === 'visible') {
      this.lockIfIdleForTooLong();
    }
  };

  private listenToTheCitizen(): void {
    document.addEventListener('visibilitychange', this.lockOnReturnIfIdleForTooLong);
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, this.noteActivity));
    const idlenessCheck = setInterval(
      () => this.lockIfIdleForTooLong(),
      IDLENESS_CHECK_INTERVAL_MS,
    );
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.lockOnReturnIfIdleForTooLong);
      ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, this.noteActivity));
      clearInterval(idlenessCheck);
    });
  }

  start(): void {
    this.lastActivityAt = this.tabSession.stored()?.lastActivityAt ?? Date.now();
    this.listenToTheCitizen();
    if (this.userService.isLocked()) {
      this.askForPassword();
    }
  }
}
