import { Page } from '@playwright/test';

export async function openTheTab(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name }).click();
}

export async function openTheHelp(page: Page): Promise<void> {
  await page.getByText('Comment ça marche ?').click();
}
