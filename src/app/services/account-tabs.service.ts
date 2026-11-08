import { Injectable, OnDestroy, signal } from '@angular/core';

export const ACCOUNTS_CHANNEL = 'organic-accounts';

interface AccountChange {
  changedAccount: string;
}

function channelToOtherTabs(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    console.error('This browser cannot tell the other tabs about account changes: keep the app open in a single tab.');
    return null;
  }
  return new BroadcastChannel(ACCOUNTS_CHANNEL);
}

@Injectable({ providedIn: 'root' })
export class AccountTabsService implements OnDestroy {
  private channel = channelToOtherTabs();
  private staleAccounts = signal<ReadonlySet<string>>(new Set());

  private markStale(publickey: string): void {
    this.staleAccounts.update((accounts) => new Set(accounts).add(publickey));
  }

  private listenToOtherTabs(): void {
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<AccountChange>) => this.markStale(event.data.changedAccount);
    }
  }

  constructor() {
    this.listenToOtherTabs();
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }

  announceChange(publickey: string): void {
    const change: AccountChange = { changedAccount: publickey };
    this.channel?.postMessage(change);
  }

  private markCurrent(publickey: string): void {
    this.staleAccounts.update((accounts) => {
      const stillStale = new Set(accounts);
      stillStale.delete(publickey);
      return stillStale;
    });
  }

  takeBack(publickey: string): void {
    this.markCurrent(publickey);
    this.announceChange(publickey);
  }

  isStale(publickey: string): boolean {
    return this.staleAccounts().has(publickey);
  }
}
