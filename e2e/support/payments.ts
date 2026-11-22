import { Page } from '@playwright/test';

export async function payContact(page: Page, contactName: string, amount: number): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Paiement' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: contactName }).click();
  await page.locator('input.amount-input').fill(String(amount));
  await page.getByRole('button', { name: 'Payer', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();
}

export async function payOneself(page: Page, amount: number): Promise<void> {
  await payContact(page, 'Moi-même', amount);
}

export async function closeTheLevelUpDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continuer' }).click();
}
