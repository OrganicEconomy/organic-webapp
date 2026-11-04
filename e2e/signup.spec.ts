import { expect, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';

test.describe('signup', () => {
  test('should open the home page for the first citizen of a fresh server', async ({ page }) => {
    await page.goto(`/signup?server=${encodeURIComponent(SERVER_URL)}`);

    await page.getByLabel('Adresse mail').fill('alice@example.org');
    await page.getByLabel('Nom & prénom').fill('Alice Dupont');
    await page.getByLabel('Date de naissance').fill('01/02/1990');
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill('secret');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText('Alice Dupont')).toBeVisible();
  });
});
