import { expect, Page, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';

async function openTheAccountInANewTab(firstTab: Page, name: string): Promise<Page> {
  const secondTab = await firstTab.context().newPage();
  await secondTab.goto('/user-selection');
  await secondTab.getByRole('button', { name }).click();
  await secondTab.getByPlaceholder('Mot de passe').fill('secret');
  await secondTab.getByRole('button', { name: 'OK' }).click();
  await expect(secondTab).toHaveURL(/\/home$/);
  return secondTab;
}

test.describe('two tabs', () => {
  test('should keep a single tab able to change the account, the last one to take it', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Maël Fontaine');

    const secondTab = await openTheAccountInANewTab(page, 'Maël Fontaine');

    await expect(page.getByText('Compte ouvert dans un autre onglet')).toBeVisible();
    await expect(secondTab.getByText('Compte ouvert dans un autre onglet')).toHaveCount(0);

    await page.getByRole('button', { name: 'Utiliser cet onglet' }).click();

    await expect(page.getByText('Compte ouvert dans un autre onglet')).toHaveCount(0);
    await expect(secondTab.getByText('Compte ouvert dans un autre onglet')).toBeVisible();
  });
});
