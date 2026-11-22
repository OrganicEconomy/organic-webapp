import { expect, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';

test.describe('pay', () => {
  test('should offer oneself only once among the recipients', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Chloé Bernard');

    await page.getByRole('link', { name: 'Paiement' }).click();
    await page.getByRole('combobox').click();

    await expect(page.getByRole('option', { name: /^moi/i })).toHaveCount(1);
  });

  test('should keep the Pay tab active in the history, and lead back to the payments', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Jade Rousseau');
    const payTab = page.getByRole('navigation').getByRole('link', { name: 'Paiement' });

    await payTab.click();
    await page.getByRole('link', { name: "Voir tout l'historique" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(payTab).toHaveClass(/active/);

    await page.getByRole('link', { name: 'Retour' }).click();
    await expect(page).toHaveURL(/\/pay$/);
  });

  test('should ask who to pay when the citizen pays without choosing anybody', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Romain Fournier');
    await page.getByRole('navigation').getByRole('link', { name: 'Paiement' }).click();

    await page.getByRole('button', { name: 'Payer', exact: true }).click();

    await expect(page.getByText('Choisis qui tu paies.')).toBeVisible();
  });

  test('should ask who to pay when the citizen pays by QR without choosing anybody', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Lina Perret');
    await page.getByRole('navigation').getByRole('link', { name: 'Paiement' }).click();
    await page.getByRole('link', { name: 'Payer par QR (hors-ligne)' }).click();

    await page.getByRole('button', { name: 'Payer par QR' }).click();

    await expect(page.getByText('Choisis qui tu paies.')).toBeVisible();
  });
});
