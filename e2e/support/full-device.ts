import { Page } from '@playwright/test';

export async function fillTheDeviceStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('The device is full.', 'QuotaExceededError');
    };
  });
}
