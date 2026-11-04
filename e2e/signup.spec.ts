import { expect, test } from '@playwright/test';
import { ensureCoreGuardian } from './support/core-guardian';
import { signUpApprovedCitizen, signUpThroughApp } from './support/signup';

test.describe('signup', () => {
  test('should show the pending validation page to a new citizen', async ({ page }) => {
    await ensureCoreGuardian();

    await signUpThroughApp(page, 'Alice Dupont');

    await expect(page).toHaveURL(/\/pending-validation$/);
    await expect(page.getByText('Bonjour Alice Dupont')).toBeVisible();
  });

  test('should open the home page once a core member approves the citizen', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Bob Martin');

    await expect(page.getByText('Bob Martin')).toBeVisible();
  });
});
