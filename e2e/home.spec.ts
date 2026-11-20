import { expect, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';

test.describe('home', () => {
  test('should tell a new citizen how many units are created for them each day', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Gaspard Roux');

    await expect(page.getByText('Création du jour : 1')).toBeVisible();
  });
});
