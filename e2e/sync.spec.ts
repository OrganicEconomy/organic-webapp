import { expect, test } from '@playwright/test';
import { approveCandidateNamed, ensureCoreGuardian } from './support/core-guardian';
import { STATUS_POLL_INTERVAL_MS, signUpThroughApp } from './support/signup';
import { storeAccount, storedAccounts } from './support/device-storage';

test.describe('sync with the server', () => {
  test('should take back, on a reload, the chain the server holds and the device lost', async ({
    page,
  }) => {
    await ensureCoreGuardian();
    await page.clock.install();
    await signUpThroughApp(page, 'Victor Lemaire');
    await expect(page).toHaveURL(/\/pending-validation$/);
    const [accountWhilePending] = await storedAccounts(page);

    await approveCandidateNamed('Victor Lemaire');
    await page.clock.fastForward(STATUS_POLL_INTERVAL_MS);
    await expect(page).toHaveURL(/\/home$/);
    const [validatedAccount] = await storedAccounts(page);

    await storeAccount(page, accountWhilePending);
    await page.reload();

    await expect(page).toHaveURL(/\/home$/);
    await expect.poll(async () => (await storedAccounts(page))[0].status).toBe('active');
    expect((await storedAccounts(page))[0].blocks).toEqual(validatedAccount.blocks);
  });
});
