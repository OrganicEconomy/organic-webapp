import { expect, Page, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';
import { ensureCoreGuardian } from './support/core-guardian';
import { signUpApprovedCitizen } from './support/signup';

async function addContact(page: Page, name: string, pk: string): Promise<void> {
  await page.getByRole('link', { name: 'Contacts' }).click();
  await page.getByRole('link', { name: 'Nouveau contact' }).click();
  await page.getByLabel('Nom').fill(name);
  await page.getByLabel('Clé publique').fill(pk);
  await page.getByLabel('Serveur').fill(SERVER_URL);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}

test.describe('add contact', () => {
  test('should list a contact registered on the server', async ({ page }) => {
    const guardian = await ensureCoreGuardian();
    await signUpApprovedCitizen(page, 'Denis Petit');

    await addContact(page, 'Gardien', guardian.publickey);

    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.getByRole('cell', { name: 'Gardien' })).toBeVisible();
  });

  test('should refuse a well-formed key that matches no citizen', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Emma Leroy');

    await addContact(page, 'Inconnu', '02' + 'ab'.repeat(32));

    await expect(page.getByText("Aucun citoyen n'a cette clé sur ce serveur.")).toBeVisible();
  });
});
