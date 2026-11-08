import { TestBed } from '@angular/core/testing';

import { ACCOUNTS_CHANNEL, AccountTabsService } from './account-tabs.service';

const ALICE_PK = '02' + 'a1'.repeat(32);

function untilMessagesAreDelivered(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

describe('AccountTabsService', () => {
  let service: AccountTabsService;
  let otherTab: BroadcastChannel;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AccountTabsService);
    otherTab = new BroadcastChannel(ACCOUNTS_CHANNEL);
  });

  afterEach(() => otherTab.close());

  describe('announceChange', () => {
    it('should tell the other tabs which account this tab just changed', async () => {
      const received: unknown[] = [];
      otherTab.onmessage = (event) => received.push(event.data);

      service.announceChange(ALICE_PK);
      await untilMessagesAreDelivered();

      expect(received).toEqual([{ changedAccount: ALICE_PK }]);
    });
  });

  describe('isStale', () => {
    it('should say that an account changed in another tab is stale in this one', async () => {
      otherTab.postMessage({ changedAccount: ALICE_PK });
      await untilMessagesAreDelivered();

      expect(service.isStale(ALICE_PK)).toBeTrue();
    });

    it('should not consider stale an account no other tab changed', () => {
      expect(service.isStale(ALICE_PK)).toBeFalse();
    });
  });

  describe('takeBack', () => {
    it('should make the account current again in this tab, and stale in the others', async () => {
      const received: unknown[] = [];
      otherTab.onmessage = (event) => received.push(event.data);
      otherTab.postMessage({ changedAccount: ALICE_PK });
      await untilMessagesAreDelivered();

      service.takeBack(ALICE_PK);
      await untilMessagesAreDelivered();

      expect(service.isStale(ALICE_PK)).toBeFalse();
      expect(received).toEqual([{ changedAccount: ALICE_PK }]);
    });
  });

  describe('ngOnDestroy', () => {
    it('should stop listening to the other tabs', async () => {
      service.ngOnDestroy();
      otherTab.postMessage({ changedAccount: ALICE_PK });
      await untilMessagesAreDelivered();

      expect(service.isStale(ALICE_PK)).toBeFalse();
    });
  });

  describe('constructor', () => {
    it('should keep the app working, and say so, in a browser that cannot talk to other tabs', () => {
      const realBroadcastChannel = window.BroadcastChannel;
      (window as any).BroadcastChannel = undefined;
      spyOn(console, 'error');
      try {
        const withoutChannel = new AccountTabsService();

        expect(() => withoutChannel.announceChange(ALICE_PK)).not.toThrow();
        expect(console.error).toHaveBeenCalled();
      } finally {
        window.BroadcastChannel = realBroadcastChannel;
      }
    });
  });
});
