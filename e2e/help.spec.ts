import { expect, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';
import { openTheTab } from './support/navigation';

test.describe('help', () => {
  test('should explain each page once the citizen asks how it works', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Lucie Fabre');
    const explanation = page.getByText("Chaque jour, vous recevez autant d'unités que votre niveau.");
    await expect(explanation).toBeHidden();

    await page.getByText('Comment ça marche ?').click();
    await expect(explanation).toBeVisible();

    await openTheTab(page, 'Contacts');
    await page.getByText('Comment ça marche ?').click();
    await expect(page.getByText('Vos contacts sont les citoyens et les écosystèmes que vous payez.')).toBeVisible();
  });
});
