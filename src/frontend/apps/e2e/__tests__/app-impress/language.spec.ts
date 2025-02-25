import { Page, expect, test } from '@playwright/test';

import { createDoc } from './common';

test.describe.serial('Language', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForLanguageSwitch(page, TestLanguage.English);
  });

  test.afterEach(async ({ page }) => {
    // Switch back to English - important for other tests to run as expected
    await waitForLanguageSwitch(page, TestLanguage.English);
  });

  test('checks language switching', async ({ page }) => {
    const header = page.locator('header').first();

    // initial language should be english
    await expect(
      page.getByRole('button', {
        name: 'New doc',
      }),
    ).toBeVisible();

    // switch to french
    await waitForLanguageSwitch(page, TestLanguage.French);

    await expect(
      header.getByRole('button').getByText('Français'),
    ).toBeVisible();

    await expect(page.getByLabel('Se déconnecter')).toBeVisible();

    await header.getByRole('button').getByText('Français').click();
    await page.getByLabel('Deutsch').click();
    await expect(header.getByRole('button').getByText('Deutsch')).toBeVisible();

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

    await waitForLanguageSwitch(page, TestLanguage.French);

    // Check for French 404 response
    await check404Response('Pas trouvé.');
  });

  test('it check translations of the slash menu when changing language', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'doc-toolbar', browserName, 1);

    const header = page.locator('header').first();
    const editor = page.locator('.ProseMirror');
    // Trigger slash menu to show english menu
    await editor.click();
    await editor.fill('/');
    await expect(page.getByText('Headings', { exact: true })).toBeVisible();
    await header.click();
    await expect(page.getByText('Headings', { exact: true })).toBeHidden();

    // Reset menu
    await editor.click();
    await editor.fill('');

    // Change language to French
    await waitForLanguageSwitch(page, TestLanguage.French);

    // Trigger slash menu to show french menu
    await editor.click();
    await editor.fill('/');
    await expect(page.getByText('Titres', { exact: true })).toBeVisible();
    await header.click();
    await expect(page.getByText('Titres', { exact: true })).toBeHidden();
  });
});

// language helper
export const TestLanguage = {
  English: {
    label: 'English',
    expectedLocale: ['en-us'],
  },
  French: {
    label: 'Français',
    expectedLocale: ['fr-fr'],
  },
  German: {
    label: 'Deutsch',
    expectedLocale: ['de-de'],
  },
} as const;

type TestLanguageKey = keyof typeof TestLanguage;
type TestLanguageValue = (typeof TestLanguage)[TestLanguageKey];

export async function waitForLanguageSwitch(
  page: Page,
  lang: TestLanguageValue,
) {
  const header = page.locator('header').first();
  await header.getByRole('button', { name: 'arrow_drop_down' }).click();

  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/user') && resp.request().method() === 'PATCH',
  );
  await page.getByLabel(lang.label).click();
  const resolvedResponsePromise = await responsePromise;
  const responseData = await resolvedResponsePromise.json();

  expect(lang.expectedLocale).toContain(responseData.language);
}
