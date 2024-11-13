import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Language', () => {
  test('checks the language picker', async ({ page }) => {
    await expect(page.getByLabel('Logout')).toBeVisible();

    const header = page.locator('header').first();
    await header.getByRole('combobox').getByText('English').click();
    await header.getByRole('option', { name: 'Français' }).click();
    await expect(
      header.getByRole('combobox').getByText('Français'),
    ).toBeVisible();

    await expect(page.getByLabel('Se déconnecter')).toBeVisible();

    await header.getByRole('combobox').getByText('Français').click();
    await header.getByRole('option', { name: 'Deutsch' }).click();
    await expect(
      header.getByRole('combobox').getByText('Deutsch'),
    ).toBeVisible();

    await expect(page.getByLabel('Abmelden')).toBeVisible();
  });

  test('checks that backend uses the same language as the frontend', async ({
    page,
  }) => {
    // Helper function to intercept and assert 404 response
    const check404Response = async (expectedDetail: string) => {
      const expectedBackendResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api') &&
          response.url().includes('non-existent-doc-uuid') &&
          response.status() === 404,
      );

      // Trigger the specific 404 XHR response by navigating to a non-existent document
      await page.goto('/docs/non-existent-doc-uuid');

      // Assert that the intercepted error message is in the expected language
      const interceptedBackendResponse = await expectedBackendResponse;
      expect(await interceptedBackendResponse.json()).toStrictEqual({
        detail: expectedDetail,
      });
    };

    // Check for English 404 response
    await check404Response('Not found.');

    // Switch language to French
    const header = page.locator('header').first();
    await header.getByRole('combobox').getByText('English').click();
    await header.getByRole('option', { name: 'Français' }).click();

    // Check for French 404 response
    await check404Response('Pas trouvé.');
  });
});
