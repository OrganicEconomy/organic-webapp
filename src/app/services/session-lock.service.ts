import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConnectedUserService } from './connected-user.service';
import { SESSION_LIFETIME_MS, TabSessionService } from './tab-session.service';
import { LockDialog } from '../components/lock-dialog/lock-dialog';

const IDLENESS_CHECK_INTERVAL_MS = 30_000;
const ACTIVITY_NOTING_INTERVAL_MS = 30_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown'];
const LOCK_DIALOG_ID = 'session-lock';

@Injectable({ providedIn: 'root' })
export class SessionLockService {
  private userService = inject(ConnectedUserService);
  private tabSession = inject(TabSessionService);
  private dialog = inject(MatDialog);
  private idlenessCheck: ReturnType<typeof setInterval> | null = null;
  private lastNotedActivityAt = 0;

  private noteActivity = (): void => {
    if (Date.now() - this.lastNotedActivityAt < ACTIVITY_NOTING_INTERVAL_MS) {
      return;
    }
    this.lastNotedActivityAt = Date.now();
    this.tabSession.noteActivity();
  };

  private isIdleForTooLong(): boolean {
    const session = this.tabSession.stored();
    return session !== null && Date.now() - session.lastActivityAt >= SESSION_LIFETIME_MS;
  }

  private isUnlocked(): boolean {
    return this.userService.getConnectedUser() !== null && !this.userService.isLocked();
  }

  private lockWhenIdleForTooLong(): void {
    if (this.isUnlocked() && this.isIdleForTooLong()) {
      this.userService.lock();
      this.askForPassword();
    }
  }

  askForPassword(): void {
    if (this.dialog.getDialogById(LOCK_DIALOG_ID)) {
      return;
    }
    this.dialog.open(LockDialog, { id: LOCK_DIALOG_ID, disableClose: true, width: '320px' });
  }

  private lockOnReturnWhenIdleForTooLong = (): void => {
    if (document.visibilityState === 'visible') {
      this.lockWhenIdleForTooLong();
    }
  };

  start(): void {
    document.addEventListener('visibilitychange', this.lockOnReturnWhenIdleForTooLong);
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, this.noteActivity));
    this.idlenessCheck = setInterval(() => this.lockWhenIdleForTooLong(), IDLENESS_CHECK_INTERVAL_MS);
    if (this.userService.isLocked()) {
      this.askForPassword();
    }
  }

  stop(): void {
    document.removeEventListener('visibilitychange', this.lockOnReturnWhenIdleForTooLong);
    ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, this.noteActivity));
    if (this.idlenessCheck !== null) {
      clearInterval(this.idlenessCheck);
    }
  }
}
