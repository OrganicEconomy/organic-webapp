import { Page } from '@playwright/test';

const DATABASE = 'OrganicMoney';
const STORE = 'keyvaluepairs';

export async function storedAccounts(page: Page): Promise<any[]> {
  return page.evaluate(
    ({ database, store }) =>
      new Promise<any[]>((resolve, reject) => {
        const opening = indexedDB.open(database);
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const reading = opening.result.transaction(store).objectStore(store).getAll();
          reading.onerror = () => reject(reading.error);
          reading.onsuccess = () => resolve(reading.result);
        };
      }),
    { database: DATABASE, store: STORE },
  );
}

export async function storeAccount(page: Page, account: any): Promise<void> {
  await page.evaluate(
    ({ database, store, account }) =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open(database);
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const writing = opening.result
            .transaction(store, 'readwrite')
            .objectStore(store)
            .put(account, account.publickey);
          writing.onerror = () => reject(writing.error);
          writing.onsuccess = () => resolve();
        };
      }),
    { database: DATABASE, store: STORE, account },
  );
}
