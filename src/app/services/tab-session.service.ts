import { Injectable } from '@angular/core';

const SESSION_KEY = 'organic-session';

const SESSION_LIFETIME_MS = 15 * 60_000;

export function hasBeenIdleForTooLong(lastActivityAt: number): boolean {
  return Date.now() - lastActivityAt >= SESSION_LIFETIME_MS;
}

export interface TabSession {
  publickey: string;
  secretKey: string | null;
  lastActivityAt: number;
  revokedByAnotherDevice?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TabSessionService {
  private hasReportedAWriteFailure = false;

  private reportWriteFailure(error: unknown): void {
    if (!this.hasReportedAWriteFailure) {
      this.hasReportedAWriteFailure = true;
      console.error(
        'This tab cannot keep its session: a reload will ask for the password again.',
        error,
      );
    }
  }

  private keep(session: TabSession): void {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      this.reportWriteFailure(error);
    }
  }

  remember(publickey: string, secretKey: string): void {
    this.keep({ publickey, secretKey, lastActivityAt: Date.now() });
  }

  private update(changes: Partial<TabSession>): void {
    const session = this.stored();
    if (session) {
      this.keep({ ...session, ...changes });
    }
  }

  forgetSecretKey(): void {
    this.update({ secretKey: null });
  }

  noteActivity(): void {
    this.update({ lastActivityAt: Date.now() });
  }

  noteRevokedByAnotherDevice(): void {
    this.update({ revokedByAnotherDevice: true });
  }

  forget(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.error('This tab cannot forget its session.', error);
    }
  }

  stored(): TabSession | null {
    try {
      const session = sessionStorage.getItem(SESSION_KEY);
      return session === null ? null : JSON.parse(session);
    } catch (error) {
      console.error('This tab cannot read its session: the password will be asked again.', error);
      return null;
    }
  }
}
