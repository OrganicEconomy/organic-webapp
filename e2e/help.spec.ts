import { expect, Page, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';
import { openTheHelp } from './support/navigation';

const FIRST_SENTENCE_OF_EACH_PAGE = [
  { path: '/home', sentence: "Chaque jour, tu reçois autant d'unités que ton niveau." },
  { path: '/contacts', sentence: 'Tes contacts sont les citoyens et les écosystèmes que tu paies.' },
  { path: '/pay', sentence: 'Choisis un contact et un montant' },
  { path: '/transactions', sentence: 'Toutes les opérations de ton compte' },
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
