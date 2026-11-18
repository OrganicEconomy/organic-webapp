import { expect, Page, test } from '@playwright/test';
import { ensureCoreGuardian } from './support/core-guardian';
import { signUpApprovedCitizen } from './support/signup';
import { addContact } from './support/contacts';

const NOT_SENT_YET = "Des opérations faites ici n'ont pas encore été envoyées au serveur.";

async function payByQr(page: Page, contactName: string): Promise<void> {
  await page.getByRole('link', { name: 'Paiement' }).click();
  await page.getByRole('link', { name: 'Payer par QR (hors-ligne)' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: contactName }).click();
  await page.locator('input.amount-input').fill('1');
  await page.getByRole('button', { name: 'Payer par QR' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByText('Faites scanner ce code')).toBeVisible();
}

test.describe('backup', () => {
  test('should say a payment made offline is not sent yet, then send it once back online', async ({
    page,
  }) => {
    const guardian = await ensureCoreGuardian();
    await signUpApprovedCitizen(page, 'Inès Moreau');
    await addContact(page, 'Gardien', guardian.publickey);
    await expect(page).toHaveURL(/\/contacts$/);

    await page.context().setOffline(true);
    await payByQr(page, 'Gardien');
    await page.getByRole('link', { name: 'Mon compte' }).click();
    await expect(page.getByText(NOT_SENT_YET)).toBeVisible();

    await page.context().setOffline(false);

    await expect(page.getByText(NOT_SENT_YET)).toBeHidden();
    await expect(page.getByText(/Dernière sauvegarde/)).toBeVisible();
  });
});
