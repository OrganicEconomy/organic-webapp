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
  private accountsInUseElsewhere = signal<ReadonlySet<string>>(new Set());

  private markInUseElsewhere(publickey: string): void {
    this.accountsInUseElsewhere.update((accounts) => new Set(accounts).add(publickey));
  }

  private listenToOtherTabs(): void {
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<AccountChange>) => this.markInUseElsewhere(event.data.changedAccount);
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

  private markInUseHere(publickey: string): void {
    this.accountsInUseElsewhere.update((accounts) => {
      const stillInUseElsewhere = new Set(accounts);
      stillInUseElsewhere.delete(publickey);
      return stillInUseElsewhere;
    });
  }

  takeBack(publickey: string): void {
    this.markInUseHere(publickey);
    this.announceChange(publickey);
  }

  isInUseElsewhere(publickey: string): boolean {
    return this.accountsInUseElsewhere().has(publickey);
  }
}
