import { Page } from '@playwright/test';

export async function openTheTab(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name }).click();
}
