import { Browser, expect, Page, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';
import { signUpApprovedCitizen } from './support/signup';

const OTHER_DEVICE_BANNER = 'Ce compte est actif sur un autre appareil — lecture seule.';

async function restoreOnAnotherDevice(browser: Browser, email: string): Promise<void> {
  const otherDevice = await browser.newContext();
  const page = await otherDevice.newPage();
  await page.goto(`/restore-account?server=${encodeURIComponent(SERVER_URL)}`);
  await page.getByLabel('Adresse mail').fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('secret');
  await page.getByRole('button', { name: 'Restaurer' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await otherDevice.close();
}

async function payOneself(page: Page, amount: number): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Paiement' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Moi-même' }).click();
  await page.locator('input.amount-input').fill(String(amount));
  await page.getByRole('button', { name: 'Payer', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();
}

async function closeTheLevelUpDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continuer' }).click();
}

test.describe('read-only banner', () => {
  test('should say on every tab that another device took the account over', async ({ page, browser }) => {
    await signUpApprovedCitizen(page, 'Inès Garnier');
    await restoreOnAnotherDevice(browser, 'insgarnier@e2e.test');

    await payOneself(page, 1);
    await closeTheLevelUpDialog(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Contacts' }).click();

    await expect(page.getByText(OTHER_DEVICE_BANNER)).toBeVisible();
  });
});
