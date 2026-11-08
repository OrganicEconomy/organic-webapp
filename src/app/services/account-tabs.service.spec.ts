import { TestBed } from '@angular/core/testing';

import { AccountTabsService } from './account-tabs.service';

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
    otherTab = new BroadcastChannel('organic-accounts');
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

    it('should not call stale an account nobody changed elsewhere', () => {
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
});
