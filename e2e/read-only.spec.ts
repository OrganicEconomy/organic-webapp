import { Browser, expect, Page, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';
import { emailOf, signUpApprovedCitizen } from './support/signup';
import { closeTheLevelUpDialog, payContact, payOneself } from './support/payments';
import { addContact } from './support/contacts';
import { ensureCoreGuardian } from './support/core-guardian';
import { openTheTab } from './support/navigation';

const OTHER_DEVICE_BANNER = 'Ce compte est actif sur un autre appareil — lecture seule.';

async function restoreOnAnotherDevice(browser: Browser, name: string): Promise<void> {
  const otherDevice = await browser.newContext();
  const page = await otherDevice.newPage();
  await page.goto(`/restore-account?server=${encodeURIComponent(SERVER_URL)}`);
  await page.getByLabel('Adresse mail').fill(emailOf(name));
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('secret');
  await page.getByRole('button', { name: 'Restaurer' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await otherDevice.close();
}

async function discoverTheTakeoverBySaving(page: Page): Promise<void> {
  await payOneself(page, 1);
  await closeTheLevelUpDialog(page);
}

test.describe('read-only banner', () => {
  test('should keep saying on each page visited that another device took the account over', async ({
    page,
    browser,
  }) => {
    await signUpApprovedCitizen(page, 'Inès Garnier');
    await restoreOnAnotherDevice(browser, 'Inès Garnier');

    await discoverTheTakeoverBySaving(page);

    await openTheTab(page, 'Contacts');
    await expect(page.getByText(OTHER_DEVICE_BANNER)).toBeVisible();
    await openTheTab(page, 'Mon compte');
    await expect(page.getByText(OTHER_DEVICE_BANNER)).toBeVisible();
  });

  test('should stay read-only once the citizen unlocks a session that another device took over', async ({
    page,
    browser,
  }) => {
    await signUpApprovedCitizen(page, 'Agathe Roy');
    await restoreOnAnotherDevice(browser, 'Agathe Roy');
    await discoverTheTakeoverBySaving(page);

    await page.clock.fastForward('15:30');
    await page.getByLabel('Mot de passe').fill('secret');
    await page.getByRole('button', { name: 'Déverrouiller' }).click();
    await expect(page.getByText('Session verrouillée')).toHaveCount(0);

    await expect(page.getByText(OTHER_DEVICE_BANNER)).toBeVisible();
  });

  test('should stay read-only once the citizen connects again to the account another device took over', async ({
    page,
    browser,
  }) => {
    const guardian = await ensureCoreGuardian();
    await signUpApprovedCitizen(page, 'Léon Barbier');
    await addContact(page, 'Gardien', guardian.publickey);
    await restoreOnAnotherDevice(browser, 'Léon Barbier');
    await payContact(page, 'Gardien', 1);
    await expect(page.getByText(OTHER_DEVICE_BANNER)).toBeVisible();

    await page.goto('/logout');
    await page.getByRole('button', { name: 'Léon Barbier' }).click();
    await page.getByLabel('Il faut ton mot de passe pour cette action').fill('secret');
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page).toHaveURL(/\/home$/);

    await expect(page.getByText(OTHER_DEVICE_BANNER)).toBeVisible();
  });
});
