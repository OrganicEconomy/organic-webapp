import { expect, Page, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';
import { ensureCoreGuardian } from './support/core-guardian';
import { pointCameraAtContactCard } from './support/fake-camera';
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

  test('should close the camera and confirm a scanned contact card', async ({ page }) => {
    const guardian = await ensureCoreGuardian();
    await pointCameraAtContactCard(page, { pk: guardian.publickey, url: SERVER_URL, n: 'Gardien' });
    await signUpApprovedCitizen(page, 'Fanny Moreau');

    await page.getByRole('link', { name: 'Contacts' }).click();
    await page.getByRole('link', { name: 'Nouveau contact' }).click();

    await expect(page.getByText('Contact reconnu : Gardien')).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.getByLabel('Clé publique')).toHaveValue(guardian.publickey);

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('cell', { name: 'Gardien', exact: true })).toBeVisible();
  });
});
