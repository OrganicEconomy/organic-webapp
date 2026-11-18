import { readFileSync } from 'node:fs';
import { Browser, expect, Page, test } from '@playwright/test';
import { SERVER_URL } from '../playwright.config';
import { ensureCoreGuardian, registerPendingCitizen } from './support/core-guardian';
import { pointCameraAtContactCard } from './support/fake-camera';
import { signUpApprovedCitizen } from './support/signup';
import { addContact } from './support/contacts';

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

async function contactLinkOf(browser: Browser, name: string): Promise<string> {
  const citizen = await newCitizenPage(browser, name);
  await citizen.getByRole('link', { name: 'Mon compte' }).click();
  await citizen.getByRole('button', { name: 'Copier mon lien de contact' }).click();
  await expect(citizen.getByText('Lien copié')).toBeVisible();
  return citizen.evaluate(() => navigator.clipboard.readText());
}

test.describe('contact link', () => {
  test('should let a citizen open, in a new tab, the link a contact shared', async ({
    browser,
  }) => {
    const link = await contactLinkOf(browser, 'Hugo Lambert');
    const ines = await newCitizenPage(browser, 'Inès Faure');

    const linkTab = await ines.context().newPage();
    await linkTab.goto(link);
    await linkTab.getByRole('button', { name: 'Inès Faure' }).click();
    await linkTab.getByPlaceholder('Mot de passe').fill('secret');
    await linkTab.getByRole('button', { name: 'OK' }).click();

    await expect(linkTab.getByLabel('Nom')).toHaveValue('Hugo Lambert');
    await linkTab.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(linkTab.getByRole('cell', { name: 'Hugo Lambert' })).toBeVisible();
  });

  test('should open the shared link straight on the filled form in a tab already connected', async ({
    browser,
  }) => {
    const link = await contactLinkOf(browser, 'Jules Lambert');
    const kim = await newCitizenPage(browser, 'Kim Faure');

    await kim.goto(link);

    await expect(kim.getByLabel('Nom')).toHaveValue('Jules Lambert');
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

  test('should import exactly the contacts that were exported', async ({ browser }) => {
    const guardian = await ensureCoreGuardian();
    const pendingCitizenPk = await registerPendingCitizen('Ophélie Marchand');
    const paul = await newCitizenPage(browser, 'Paul Rivière');
    await addContact(paul, 'Gardien', guardian.publickey);
    await addContact(paul, 'Ophélie', pendingCitizenPk);
    const exportedByPaul = await contactsExportedBy(paul);

    const rose = await newCitizenPage(browser, 'Rose Rivière');
    await rose.getByRole('link', { name: 'Contacts' }).click();
    await rose.locator('.import-file-picker').setInputFiles({
      name: 'contacts.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exportedByPaul)),
    });
    await expect(rose.getByText('2 contacts ajoutés.')).toBeVisible();

    const exportedByRose = await contactsExportedBy(rose);
    expect(exportedByRose.contacts).toEqual(exportedByPaul.contacts);
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
