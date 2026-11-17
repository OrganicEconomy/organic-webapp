import { expect, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';

test.describe('session', () => {
  test('should stay connected through a reload of the page', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Sacha Benoît');

    await page.reload();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText('Sacha Benoît')).toBeVisible();
  });

  test('should ask for the password on the same page after 15 minutes without activity', async ({
    page,
  }) => {
    await signUpApprovedCitizen(page, 'Timéo Benoît');
    await page.getByRole('link', { name: 'Contacts' }).click();

    await page.clock.fastForward('15:30');
    await expect(page.getByText('Session verrouillée')).toBeVisible();
    await page.clock.setSystemTime(new Date());
    await page.goBack();
    await expect(page.getByText('Session verrouillée')).toBeVisible();

    await page.getByLabel('Mot de passe').fill('secret');
    await page.getByRole('button', { name: 'Déverrouiller' }).click();

    await expect(page.getByText('Session verrouillée')).toHaveCount(0);
    await page.getByRole('link', { name: 'Mon compte' }).click();
    await expect(page.getByRole('button', { name: 'Changer le mot de passe' })).toBeEnabled();
  });

  test('should forget the session when logging out, even through a reload', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Ugo Benoît');
    await page.getByRole('link', { name: 'Mon compte' }).click();

    await page.getByRole('link', { name: 'Déconnexion' }).click();
    await expect(page).toHaveURL(/\/user-selection$/);
    await page.goto('/home');

    await expect(page).toHaveURL(/\/user-selection$/);
  });
});
