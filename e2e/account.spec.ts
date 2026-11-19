import { expect, Page, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';

async function myPublicKey(page: Page): Promise<string> {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('organic-session')!).publickey);
}

async function openMyAccount(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Mon compte' }).click();
}

test.describe('my account', () => {
  test('should show my whole key, and copy it for me', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signUpApprovedCitizen(page, 'Romane Leclerc');
    const myKey = await myPublicKey(page);

    await openMyAccount(page);
    const shownKey = page.getByText(myKey, { exact: true });
    await expect(shownKey).toBeVisible();
    expect(await shownKey.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    await page.getByRole('button', { name: 'Copier ma clé' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(myKey);
  });
});
