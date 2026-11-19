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

async function expectAboveTheBottomBar(page: Page, name: string): Promise<void> {
  const link = await page.getByRole('link', { name }).boundingBox();
  const bottomBar = await page.getByRole('navigation').boundingBox();
  expect(link!.y + link!.height).toBeLessThanOrEqual(bottomBar!.y);
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

  test('should keep the title and the back button in sight while the rows scroll', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Clara Mercier');
    await page.setViewportSize({ width: 412, height: 340 });

    await openTheHistory(page);
    const rows = page.getByRole('region', { name: 'Liste des transactions' });
    await rows.evaluate((area) => area.scrollTo(0, area.scrollHeight));

    expect(await rows.evaluate((area) => area.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'Historique des transactions' })).toBeInViewport();
    await expectAboveTheBottomBar(page, 'Retour');
  });

  test('should keep the back button in sight under the banner of another tab', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Hugo Barbier');
    const secondTab = await page.context().newPage();
    await secondTab.goto('/user-selection');
    await secondTab.getByRole('button', { name: 'Hugo Barbier' }).click();
    await secondTab.getByPlaceholder('Mot de passe').fill('secret');
    await secondTab.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Compte ouvert dans un autre onglet')).toBeVisible();
    await page.setViewportSize({ width: 412, height: 340 });

    await openTheHistory(page);
    await expect(page.getByText('Compte ouvert dans un autre onglet')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));

    await expectAboveTheBottomBar(page, 'Retour');
  });
});
