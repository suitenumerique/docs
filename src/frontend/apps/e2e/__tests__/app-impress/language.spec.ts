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

  test('it checks theme_customization.translations config', async ({
    page,
  }) => {
    await overrideConfig(page, {
      theme_customization: {
        translations: {
          en: {
            translation: {
              Docs: 'MyCustomDocs',
            },
          },
        },
        header: {
          logo: {},
          icon: {
            withTitle: true,
          },
        },
      },
    });

    await page.goto('/');

    await expect(page.getByText('MyCustomDocs')).toBeAttached();
  });

  test('checks language switching', async ({ page }) => {
    // switch to french
    await waitForLanguageSwitch(page, TestLanguage.French);

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await page.getByLabel('Menu utilisateur').click();
    await expect(
      page.getByRole('button', { name: 'Language: Français' }),
    ).toBeVisible();

    await expect(page.getByText('Déconnexion')).toBeVisible();

    await page.keyboard.press('Escape');

    // Switch to German using the utility function for consistency
    await waitForLanguageSwitch(page, TestLanguage.German, 'Menu utilisateur');

    await page.getByLabel('User menu').click();
    await expect(
      page.getByRole('button', { name: 'Language: Deutsch' }),
    ).toBeVisible();

    await expect(page.getByText('Logout', { exact: true })).toBeVisible();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });

  test('can switch language using only keyboard', async ({ page }) => {
    await waitForLanguageSwitch(page, TestLanguage.English, 'User menu', false);

    await page.getByLabel('User menu').click();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('menuitem', { name: 'English' })).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Français' }),
    ).toBeVisible();

    await page.waitForTimeout(300);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(
      page.getByRole('button', { name: 'Déconnexion' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');

    await page.getByLabel('Menu utilisateur').click();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('checks that backend uses the same language as the frontend', async ({
    page,
  }) => {
    // Helper function to intercept and assert 404 response
    const check404Response = async (expectedDetail: string) => {
      const interceptedBackendResponse = await page.request.get(
        `${process.env.BASE_API_URL}/documents/non-existent-doc-uuid/`,
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
    await check404Response('Non trouvé.');
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
    await waitForLanguageSwitch(page, TestLanguage.Swedish, 'Menu utilisateur');
    await openSuggestionMenu({ page });
    await expect(
      suggestionMenu.getByText('Headings', { exact: true }),
    ).toBeVisible();
  });
});
