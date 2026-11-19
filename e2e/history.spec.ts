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

    const accountOpeningCard = page.locator('.tx-card', { hasText: 'Ouverture du compte' });
    const dailyCreationCard = page.locator('.tx-card', { hasText: 'Création du jour' });
    await expect(accountOpeningCard).toBeVisible();
    await expect(dailyCreationCard).toBeVisible();
    await expect(accountOpeningCard).not.toContainText('→');
    await expect(dailyCreationCard).not.toContainText('→');
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
});
