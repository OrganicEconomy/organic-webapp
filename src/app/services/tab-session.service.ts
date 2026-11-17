import { Injectable } from '@angular/core';

const SESSION_KEY = 'organic-session';

export const SESSION_LIFETIME_MS = 15 * 60_000;

export interface TabSession {
  publickey: string;
  secretKey: string | null;
  lastActivityAt: number;
}

@Injectable({ providedIn: 'root' })
export class TabSessionService {
  private keep(session: TabSession): void {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('This tab cannot keep its session: a reload will ask for the password again.', error);
    }
  }

  remember(publickey: string, secretKey: string): void {
    this.keep({ publickey, secretKey, lastActivityAt: Date.now() });
  }

  forgetSecretKey(): void {
    const session = this.stored();
    if (session) {
      this.keep({ ...session, secretKey: null });
    }
  }

  noteActivity(): void {
    const session = this.stored();
    if (session) {
      this.keep({ ...session, lastActivityAt: Date.now() });
    }
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
