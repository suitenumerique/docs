import { expect, test } from '@playwright/test';

test.describe('Login: Not logged', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('It tries silent login', async ({ page }) => {
    const silentLoginRequest = page.waitForRequest((request) =>
      request.url().includes('/api/v1.0/authenticate/?silent=true'),
    );

    await page.goto('/');

    await silentLoginRequest;
    expect(silentLoginRequest).toBeDefined();
  });
});
