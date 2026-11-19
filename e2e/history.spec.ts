import { expect, Page, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';

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
});
