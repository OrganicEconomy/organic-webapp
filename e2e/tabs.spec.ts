import { expect, Page, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';
import { ensureCoreGuardian } from './support/core-guardian';
import { signUpApprovedCitizen } from './support/signup';

const OTHER_TAB_BANNER = 'Compte ouvert dans un autre onglet : celui-ci est en lecture seule.';

async function openTheAccountInANewTab(firstTab: Page, name: string): Promise<Page> {
  const secondTab = await firstTab.context().newPage();
  await secondTab.goto('/user-selection');
  await secondTab.getByRole('button', { name }).click();
  await secondTab.getByPlaceholder('Mot de passe').fill('secret');
  await secondTab.getByRole('button', { name: 'OK' }).click();
  await expect(secondTab).toHaveURL(/\/home$/);
  return secondTab;
}

async function addContact(page: Page, name: string, pk: string): Promise<void> {
  await page.getByRole('link', { name: 'Contacts' }).click();
  await page.getByRole('link', { name: 'Nouveau contact' }).click();
  await page.getByLabel('Nom').fill(name);
  await page.getByLabel('Clé publique').fill(pk);
  await page.getByLabel('Serveur').fill(SERVER_URL);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}

test.describe('two tabs', () => {
  test('should let only the last tab that opened the account change it', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Maël Fontaine');

    const secondTab = await openTheAccountInANewTab(page, 'Maël Fontaine');

    await expect(page.getByText(OTHER_TAB_BANNER)).toBeVisible();
    await expect(secondTab.getByText(OTHER_TAB_BANNER)).toHaveCount(0);

    await page.getByRole('button', { name: 'Utiliser cet onglet' }).click();

    await expect(page.getByText(OTHER_TAB_BANNER)).toHaveCount(0);
    await expect(secondTab.getByText(OTHER_TAB_BANNER)).toBeVisible();
  });

  test('should take the account back with what the other tab stored', async ({ page }) => {
    const guardian = await ensureCoreGuardian();
    await signUpApprovedCitizen(page, 'Noé Girard');
    const secondTab = await openTheAccountInANewTab(page, 'Noé Girard');

    await addContact(secondTab, 'Gardien', guardian.publickey);
    await expect(secondTab.getByRole('cell', { name: 'Gardien' })).toBeVisible();

    await page.getByRole('button', { name: 'Utiliser cet onglet' }).click();
    await page.getByRole('link', { name: 'Contacts' }).click();

    await expect(page.getByRole('cell', { name: 'Gardien' })).toBeVisible();
  });
});
