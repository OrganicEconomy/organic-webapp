import { Injectable, signal } from '@angular/core';

const CHANNEL_NAME = 'organic-accounts';

interface AccountChange {
  changedAccount: string;
}

@Injectable({ providedIn: 'root' })
export class AccountTabsService {
  private channel = new BroadcastChannel(CHANNEL_NAME);
  private staleAccounts = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.channel.onmessage = (event: MessageEvent<AccountChange>) => {
      this.markStale(event.data.changedAccount);
    };
  }

  private markStale(publickey: string): void {
    this.staleAccounts.update((accounts) => new Set(accounts).add(publickey));
  }

  announceChange(publickey: string): void {
    this.channel.postMessage({ changedAccount: publickey });
  }

  takeBack(publickey: string): void {
    this.staleAccounts.update((accounts) => {
      const stillStale = new Set(accounts);
      stillStale.delete(publickey);
      return stillStale;
    });
    this.announceChange(publickey);
  }

  isStale(publickey: string): boolean {
    return this.staleAccounts().has(publickey);
  }
}
