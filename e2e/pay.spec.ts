import { expect, test } from '@playwright/test';
import { signUpApprovedCitizen } from './support/signup';

test.describe('pay', () => {
  test('should offer oneself only once among the recipients', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Chloé Bernard');

    await page.getByRole('link', { name: 'Paiement' }).click();
    await page.getByRole('combobox').click();

    await expect(page.getByRole('option', { name: /^moi/i })).toHaveCount(1);
  });
});
