import { expect, test } from '@playwright/test';
import { ensureCoreGuardian } from './support/core-guardian';
import { fillTheDeviceStorage } from './support/full-device';
import { emailOf, signUpApprovedCitizen, signUpThroughApp } from './support/signup';

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

  test('should send to the restore page a citizen whose device is too full to store the new account', async ({ page }) => {
    await ensureCoreGuardian();
    await fillTheDeviceStorage(page);
    const alertShown = page.waitForEvent('dialog');

    await signUpThroughApp(page, 'Chloé Petit');

    const alert = await alertShown;
    expect(alert.message()).toContain("cet appareil n'a pas pu l'enregistrer");
    await alert.accept();
    await expect(page).toHaveURL(/\/restore-account\?server=/);
  });

  test('should say that the mail is already used when another account was created with it', async ({ page, browser }) => {
    await ensureCoreGuardian();
    await signUpThroughApp(page, 'Alice Fontaine');
    await expect(page).toHaveURL(/\/pending-validation$/);
    const otherDevice = await browser.newContext();
    const otherPage = await otherDevice.newPage();
    const alertShown = otherPage.waitForEvent('dialog');

    await signUpThroughApp(otherPage, 'Alice Moreau', emailOf('Alice Fontaine'));

    const alert = await alertShown;
    expect(alert.message()).toBe('Cette adresse mail est déjà utilisée par un autre compte.');
    await alert.accept();
    await otherDevice.close();
  });
});
