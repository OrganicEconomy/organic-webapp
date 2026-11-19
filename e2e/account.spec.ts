import { expect, Page, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';
import { storedAccounts } from './support/device-storage';
import { openTheTab } from './support/navigation';

async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

test.describe('my account', () => {
  test('should show my whole key, and copy it for me', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signUpApprovedCitizen(page, 'Romane Leclerc');
    const [myAccount] = await storedAccounts(page);

    await openTheTab(page, 'Mon compte');
    await expect(page.getByText(myAccount.publickey, { exact: true })).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);

    await page.getByRole('button', { name: 'Copier ma clé' }).click();
    await expect(page.getByText('Clé copiée.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(myAccount.publickey);
  });
});
