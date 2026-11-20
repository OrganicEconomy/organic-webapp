import { expect, Page, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';
import { ensureCoreGuardian } from './support/core-guardian';
import { signUpApprovedCitizen, signUpThroughApp } from './support/signup';

async function corePk(): Promise<string> {
  const response = await fetch(`${SERVER_URL}/api/v1/info`);
  const info = await response.json();
  return info.corePk;
}

async function engageInvests(page: Page, ecosystemPk: string, dailyAmount: number): Promise<void> {
  await page.getByLabel('Montant par jour').fill(String(dailyAmount));
  await page.getByLabel('Nombre de jours').fill('1');
  await page.getByRole('button', { name: 'Engager' }).click();
  await expect(page).toHaveURL(new RegExp(`/ecosystems/${ecosystemPk}$`));
}

test.describe('ecosystems', () => {
  test('should tell a citizen awaiting validation that only an active citizen can create an ecosystem', async ({ page }) => {
    await ensureCoreGuardian();
    await signUpThroughApp(page, 'Hugo Lefèvre');
    await expect(page).toHaveURL(/\/pending-validation$/);

    await page.goto('/ecosystems/new');
    await page.getByLabel('Nom').fill('Jardin partagé');
    await page.getByRole('button', { name: 'Créer' }).click();

    await expect(page.getByText('Il faut être citoyen actif, au compte validé, pour créer un écosystème.')).toBeVisible();
  });

  test('should tell a citizen how much they can invest each day, and when nothing is left', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Margot Blanc');
    const core = await corePk();

    await page.goto(`/ecosystems/${core}/invest`);
    await expect(page.getByText("Maximum : 1 / jour. C'est votre niveau, moins ce que vous avez déjà engagé pour aujourd'hui.")).toBeVisible();
    await engageInvests(page, core, 1);

    await page.goto(`/ecosystems/${core}/invest`);
    await expect(page.getByText("Tous vos investissements d'aujourd'hui sont déjà engagés.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Engager' })).toBeDisabled();
  });
});
