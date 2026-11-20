import { expect, Page, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';
import { openTheHelp } from './support/navigation';

const FIRST_SENTENCE_OF_EACH_PAGE = [
  { path: '/home', sentence: "Chaque jour, vous recevez autant d'unités que votre niveau." },
  { path: '/contacts', sentence: 'Vos contacts sont les citoyens et les écosystèmes que vous payez.' },
  { path: '/pay', sentence: 'Choisissez un contact et un montant' },
  { path: '/transactions', sentence: 'Toutes les opérations de votre compte' },
  { path: '/ecosystems', sentence: 'Un écosystème est un projet collectif' },
];

async function isUnderThePageCardAndAsWide(page: Page): Promise<boolean> {
  const card = await page.locator('mat-card').first().boundingBox();
  const help = await page.locator('app-help-panel').boundingBox();
  return help!.y > card!.y && help!.width >= card!.width * 0.9;
}

test.describe('help', () => {
  test('should keep the explanation folded until the citizen asks how the page works', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Lucie Fabre');
    const explanation = page.getByText(FIRST_SENTENCE_OF_EACH_PAGE[0].sentence);
    await expect(explanation).toBeHidden();

    await openTheHelp(page);

    await expect(explanation).toBeVisible();
  });

  test('should explain each page under its content, as wide as it', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Basile Perrot');

    for (const { path, sentence } of FIRST_SENTENCE_OF_EACH_PAGE) {
      await page.goto(path);
      await openTheHelp(page);

      await expect(page.getByText(sentence)).toBeVisible();
      expect(await isUnderThePageCardAndAsWide(page), path).toBe(true);
    }
  });
});
