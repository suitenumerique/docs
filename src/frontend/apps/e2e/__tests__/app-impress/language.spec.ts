import { expect, test } from '@playwright/test';

import {
  TestLanguage,
  createDoc,
  overrideConfig,
  waitForLanguageSwitch,
} from './utils-common';
import { openSuggestionMenu } from './utils-editor';

test.describe('Language', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checks language switching', async ({ page }) => {
    const header = page.locator('header').first();
    const languagePicker = header.locator('.--docs--language-picker-text');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-us');

    // initial language should be english
    await expect(
      page.getByRole('button', {
        name: 'New doc',
      }),
    ).toBeVisible();

    // switch to french
    await waitForLanguageSwitch(page, TestLanguage.French);

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await expect(
      header.getByRole('button').getByText('Français'),
    ).toBeVisible();

    await expect(page.getByLabel('Se déconnecter')).toBeVisible();

    // Switch to German using the utility function for consistency
    await waitForLanguageSwitch(page, TestLanguage.German);
    await expect(header.getByRole('button').getByText('Deutsch')).toBeVisible();

    await expect(page.getByLabel('Abmelden')).toBeVisible();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    await languagePicker.click();

    await expect(page.locator('[role="menu"]')).toBeVisible();

    const menuItems = page.getByRole('menuitem');
    await expect(menuItems.first()).toBeVisible();

    await menuItems.first().click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(languagePicker).toContainText('English');
  });

  test('can switch language using only keyboard', async ({ page }) => {
    await page.goto('/');
    await waitForLanguageSwitch(page, TestLanguage.English);

    const languagePicker = page.getByRole('button', {
      name: /select language/i,
    });

    await expect(languagePicker).toBeVisible();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await page.keyboard.press('Enter');

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('html')).not.toHaveAttribute('lang', 'en-us');
  });

  test('checks that backend uses the same language as the frontend', async ({
    page,
  }) => {
    // Helper function to intercept and assert 404 response
    const check404Response = async (expectedDetail: string) => {
      const interceptedBackendResponse = await page.request.get(
        'http://localhost:8071/api/v1.0/documents/non-existent-doc-uuid/',
      );

      // Assert that the intercepted error message is in the expected language
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
    await overrideConfig(page, {
      LANGUAGES: [
        ['en-us', 'English'],
        ['fr-fr', 'Français'],
        ['sv-se', 'Svenska'],
      ],
      LANGUAGE_CODE: 'en-us',
    });

    await createDoc(page, 'doc-toolbar', browserName, 1);

    const { editor, suggestionMenu } = await openSuggestionMenu({ page });
    await expect(
      suggestionMenu.getByText('Headings', { exact: true }),
    ).toBeVisible();

    await editor.click(); // close the menu

    await expect(page.getByText('Headings', { exact: true })).toBeHidden();

    // Change language to French
    await waitForLanguageSwitch(page, TestLanguage.French);

    // Trigger slash menu to show french menu
    await openSuggestionMenu({ page });
    await expect(
      suggestionMenu.getByText('Titres', { exact: true }),
    ).toBeVisible();

    /**
     * Swedish is not yet supported in the BlockNote locales, so it should fallback to English
     */
    await waitForLanguageSwitch(page, TestLanguage.Swedish);
    await openSuggestionMenu({ page });
    await expect(
      suggestionMenu.getByText('Headings', { exact: true }),
    ).toBeVisible();
  });
});
