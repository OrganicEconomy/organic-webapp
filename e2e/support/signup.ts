import { expect, Page } from '@playwright/test';
import { SERVER_URL } from '../../playwright.config';
import { approveCandidateNamed, ensureCoreGuardian } from './core-guardian';

export const STATUS_POLL_INTERVAL_MS = 30_000;

export async function signUpThroughApp(page: Page, name: string): Promise<void> {
  await page.goto(`/signup?server=${encodeURIComponent(SERVER_URL)}`);

  await page.getByLabel('Adresse mail').fill(`${name.replace(/\W/g, '').toLowerCase()}@e2e.test`);
  await page.getByLabel('Nom & prénom').fill(name);
  await page.getByLabel('Date de naissance').fill('01/02/1990');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('secret');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
}

export async function signUpApprovedCitizen(page: Page, name: string): Promise<void> {
  await ensureCoreGuardian();
  await page.clock.install();
  await signUpThroughApp(page, name);
  await expect(page).toHaveURL(/\/pending-validation$/);

  await approveCandidateNamed(name);
  await page.clock.fastForward(STATUS_POLL_INTERVAL_MS);
  await expect(page).toHaveURL(/\/home$/);
}
