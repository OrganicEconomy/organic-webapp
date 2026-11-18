import { expect, Page, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';

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

async function openTheHistory(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Paiement' }).click();
  await page.getByRole('link', { name: "Voir tout l'historique" }).click();
}

test.describe('history', () => {
  test('should show the account opening and the daily creation with neither sender nor receiver', async ({
    page,
  }) => {
    await signUpApprovedCitizen(page, 'Lina Fontaine');

    await openTheHistory(page);

    const opening = page.locator('.tx-card', { hasText: 'Ouverture du compte' });
    const creation = page.locator('.tx-card', { hasText: 'Création du jour' });
    await expect(opening).toBeVisible();
    await expect(creation).toBeVisible();
    await expect(opening).not.toContainText('→');
    await expect(creation).not.toContainText('→');
  });

  test('should sign each amount, and show the experience a payment brings', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Noé Chevalier');
    await payOneself(page, 1);
    await closeTheLevelUpDialog(page);

    await openTheHistory(page);

    await expect(page.locator('.tx-card', { hasText: 'Création du jour' })).toContainText('+1');
    const cashing = page.locator('.tx-card', { hasText: 'Encaissement' });
    await expect(cashing).toContainText('−1');
    await expect(cashing).toContainText('+1 XP');
    const opening = page.locator('.tx-card', { hasText: 'Ouverture du compte' });
    await expect(opening.locator('app-transaction-amounts')).toHaveText('');
  });

  test('should group the rows by month, and find them by words without accents or by type', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Yanis Perrin');

    await openTheHistory(page);
    await expect(page.locator('.month-heading', { hasText: 'février 1990' })).toBeVisible();

    await page.getByLabel('Rechercher').fill('creation');
    await expect(page.locator('.tx-card')).toHaveCount(1);
    await expect(page.locator('.tx-card')).toContainText('Création du jour');

    await page.getByLabel('Rechercher').fill('');
    await page.getByRole('combobox', { name: 'Type' }).click();
    await page.getByRole('option', { name: 'Ouverture du compte' }).click();
    await expect(page.locator('.tx-card')).toHaveCount(1);
    await expect(page.locator('.tx-card')).toContainText('Ouverture du compte');
  });
});
