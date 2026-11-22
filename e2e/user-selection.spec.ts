import { expect, test } from '@playwright/test';
import { storeAccount } from './support/device-storage';

const DUPLICATED_TRACK_KEYS_WARNING = 'NG0955';

test.describe('account list', () => {
  test('should list two accounts of the same name without mixing them up', async ({ page }) => {
    await page.goto('/user-selection');
    await expect(page).toHaveURL(/\/server-selection$/);
    await storeAccount(page, { name: 'Alice Dupont', publickey: 'pk-of-the-first' });
    await storeAccount(page, { name: 'Alice Dupont', publickey: 'pk-of-the-second' });
    const warnings: string[] = [];
    page.on('console', (message) => warnings.push(message.text()));

    await page.goto('/user-selection');

    await expect(page.getByRole('button', { name: 'Alice Dupont' })).toHaveCount(2);
    expect(warnings.filter((warning) => warning.includes(DUPLICATED_TRACK_KEYS_WARNING))).toEqual([]);
  });
});
