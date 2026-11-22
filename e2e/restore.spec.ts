import { Browser, expect, Page, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';
import { emailOf, signUpApprovedCitizen } from './support/signup';

async function signUpOnItsOwnDevice(browser: Browser, name: string): Promise<void> {
  const device = await browser.newContext();
  await signUpApprovedCitizen(await device.newPage(), name);
  await device.close();
}

async function restore(page: Page, name: string): Promise<void> {
  await page.goto(`/restore-account?server=${encodeURIComponent(SERVER_URL)}`);
  await page.getByLabel('Adresse mail').fill(emailOf(name));
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('secret');
  await page.getByRole('button', { name: 'Restaurer' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test.describe('restore account', () => {
  test('should list each restored account under its own name', async ({ page, browser }) => {
    await signUpOnItsOwnDevice(browser, 'Alice Lambert');
    await signUpOnItsOwnDevice(browser, 'Alice Girard');

    await restore(page, 'Alice Lambert');
    await restore(page, 'Alice Girard');
    await page.goto('/logout');

    await expect(page.getByRole('button', { name: 'Alice Lambert' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alice Girard' })).toBeVisible();
  });
});
