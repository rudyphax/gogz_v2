import { test as base, expect, type Browser, type Page } from '@playwright/test';

export const ADMIN = 'admin@e2e.test';
export const AL = 'al@e2e.test';
export const BO = 'bo@e2e.test';

/** Signs in through the test-only route, which runs the same allowlist check as Google. */
export async function signIn(page: Page, email: string, givenName?: string) {
  const res = await page.request.post('/api/test/google-login', { data: { email, givenName } });
  expect(res.ok(), `sign-in for ${email}`).toBeTruthy();
}

export async function newUserPage(browser: Browser, email: string, givenName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email, givenName);
  return page;
}

export async function sentTexts(page: Page): Promise<{ to: string; body: string }[]> {
  return (await page.request.get('/api/test/sms')).json();
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const res = await page.request.post('/api/test/reset', {
      data: { admin: ADMIN, members: [AL, BO] },
    });
    expect(res.status()).toBe(204);
    await use(page);
  },
});

export { expect };
