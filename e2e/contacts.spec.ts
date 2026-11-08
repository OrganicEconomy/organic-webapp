import { readFileSync } from 'node:fs';
import { Browser, expect, Page, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';
import { ensureCoreGuardian, registerPendingCitizen } from './support/core-guardian';
import { pointCameraAtContactCard } from './support/fake-camera';
import { signUpApprovedCitizen } from './support/signup';

async function addContact(page: Page, name: string, pk: string): Promise<void> {
  await page.getByRole('link', { name: 'Contacts' }).click();
  await page.getByRole('link', { name: 'Nouveau contact' }).click();
  await page.getByLabel('Nom').fill(name);
  await page.getByLabel('Clé publique').fill(pk);
  await page.getByLabel('Serveur').fill(SERVER_URL);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}

test.describe('add contact', () => {
  test('should list a contact registered on the server', async ({ page }) => {
    const guardian = await ensureCoreGuardian();
    await signUpApprovedCitizen(page, 'Denis Petit');

    await addContact(page, 'Gardien', guardian.publickey);

    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.getByRole('cell', { name: 'Gardien' })).toBeVisible();
  });

  test('should refuse a well-formed key that matches no citizen', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Emma Leroy');

    await addContact(page, 'Inconnu', '02' + 'ab'.repeat(32));

    await expect(page.getByText("Aucun citoyen n'a cette clé sur ce serveur.")).toBeVisible();
  });

  test('should close the camera and confirm a scanned contact card', async ({ page }) => {
    const guardian = await ensureCoreGuardian();
    await pointCameraAtContactCard(page, { pk: guardian.publickey, url: SERVER_URL, n: 'Gardien' });
    await signUpApprovedCitizen(page, 'Fanny Moreau');

    await page.getByRole('link', { name: 'Contacts' }).click();
    await page.getByRole('link', { name: 'Nouveau contact' }).click();

    await expect(page.getByText('Contact reconnu : Gardien')).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.getByLabel('Clé publique')).toHaveValue(guardian.publickey);

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('cell', { name: 'Gardien', exact: true })).toBeVisible();
  });
});

test.describe('contacts', () => {
  test('should list the contacts by name and filter them with the search', async ({ page }) => {
    const guardian = await ensureCoreGuardian();
    const zoePk = await registerPendingCitizen('Zoé Garnier');
    await signUpApprovedCitizen(page, 'Gaby Roux');
    await addContact(page, 'Zoé', zoePk);
    await addContact(page, 'Gardien', guardian.publickey);

    const nameCells = page.locator('td.mat-column-name');
    await expect(nameCells).toHaveText(['Gardien', 'Zoé']);

    await page.getByLabel('Rechercher').fill('zoe');
    await expect(nameCells).toHaveText(['Zoé']);

    await page.getByLabel('Rechercher').fill('xavier');
    await expect(page.getByText('Aucun contact ne correspond à « xavier ».')).toBeVisible();
  });
});

async function newCitizenPage(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await signUpApprovedCitizen(page, name);
  return page;
}

test.describe('contact server', () => {
  test('should prefill my own server and offer the other known servers', async ({ page }) => {
    await signUpApprovedCitizen(page, 'Jade Mercier');
    await page.getByRole('link', { name: 'Contacts' }).click();
    await page.getByRole('link', { name: 'Nouveau contact' }).click();

    const serverField = page.getByLabel('Serveur');
    await expect(serverField).toHaveValue(SERVER_URL);

    await serverField.fill('');
    await page.getByRole('option', { name: 'Trifouillis' }).click();
    await expect(serverField).toHaveValue('https://trifouillis.fr');
  });
});

test.describe('contact link', () => {
  test('should let a citizen add a contact from the link that contact shared', async ({
    browser,
  }) => {
    const hugo = await newCitizenPage(browser, 'Hugo Lambert');
    await hugo.getByRole('link', { name: 'Mon compte' }).click();
    await hugo.getByRole('button', { name: 'Copier mon lien de contact' }).click();
    await expect(hugo.getByText('Lien copié')).toBeVisible();
    const link = await hugo.evaluate(() => navigator.clipboard.readText());

    const ines = await newCitizenPage(browser, 'Inès Faure');
    await ines.goto(link);
    await ines.getByRole('button', { name: 'Inès Faure' }).click();
    await ines.getByPlaceholder('Mot de passe').fill('secret');
    await ines.getByRole('button', { name: 'OK' }).click();

    await expect(ines.getByLabel('Nom')).toHaveValue('Hugo Lambert');
    await ines.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(ines.getByRole('cell', { name: 'Hugo Lambert' })).toBeVisible();
  });
});

async function contactsExportedBy(page: Page): Promise<any> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter mes contacts' }).click();
  const filePath = await (await download).path();
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

test.describe('contacts file', () => {
  test('should export the contacts in a file', async ({ page }) => {
    const guardian = await ensureCoreGuardian();
    await signUpApprovedCitizen(page, 'Jade Lambert');
    await addContact(page, 'Gardien', guardian.publickey);

    const exported = await contactsExportedBy(page);

    expect(exported.contacts).toEqual([
      { name: 'Gardien', pk: guardian.publickey, url: SERVER_URL, type: 'citizen' },
    ]);
  });

  test('should import on a new device the contacts exported on the old one', async ({
    browser,
  }) => {
    const guardian = await ensureCoreGuardian();
    const kevin = await newCitizenPage(browser, 'Kévin Morel');
    await addContact(kevin, 'Gardien', guardian.publickey);
    const exported = await contactsExportedBy(kevin);
    exported.contacts.push({ name: 'Clé abîmée', pk: 'abcdef', url: SERVER_URL, type: 'citizen' });

    const lea = await newCitizenPage(browser, 'Léa Morel');
    await lea.getByRole('link', { name: 'Contacts' }).click();
    await lea.locator('.import-file-picker').setInputFiles({
      name: 'contacts.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exported)),
    });

    await expect(lea.getByText('1 contact ajouté.')).toBeVisible();
    await expect(lea.getByText("Clé abîmée : Cette clé publique n'est pas valide")).toBeVisible();
    await expect(lea.getByRole('cell', { name: 'Gardien' })).toBeVisible();
  });
});
