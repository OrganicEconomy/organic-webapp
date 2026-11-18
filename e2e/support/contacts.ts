import { Page } from '@playwright/test';
import { SERVER_URL } from '../../playwright.config';

export async function addContact(page: Page, name: string, publicKey: string): Promise<void> {
  await page.getByRole('link', { name: 'Contacts' }).click();
  await page.getByRole('link', { name: 'Nouveau contact' }).click();
  await page.getByLabel('Nom').fill(name);
  await page.getByLabel('Clé publique').fill(publicKey);
  await page.getByLabel('Serveur').fill(SERVER_URL);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}
