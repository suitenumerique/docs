import { expect, test } from '@playwright/test';

import {
  createDoc,
  getCurrentConfig,
  overrideConfig,
  verifyDocName,
} from './utils-common';
import { writeInEditor } from './utils-editor';
import { SignIn, expectLoginPage } from './utils-signin';

test.describe('Doc Routing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Check the presence of the meta tag noindex', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'doc-routing-test', browserName, 1);
    const metaDescription = page.locator('meta[name="robots"]');
    await expect(metaDescription).toHaveAttribute('content', 'noindex');
  });

  test('checks alias docs url with homepage', async ({ page }) => {
    await expect(page).toHaveURL('/');

    const buttonCreateHomepage = page.getByRole('link', {
      name: 'New',
      exact: true,
    });

    await expect(buttonCreateHomepage).toBeVisible();

    await page.goto('/docs/');
    await expect(buttonCreateHomepage).toBeVisible();
    await expect(page).toHaveURL(/\/docs\/$/);
  });

  test('checks 500 refresh retries original document request', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(page, 'doc-routing-500', browserName, 1);
    await verifyDocName(page, docTitle);

    const docId = page.url().split('/docs/')[1]?.split('/')[0];
    // While true, every doc GET fails (including React Query retries) so we
    // reliably land on /500. Set to false before refresh so the doc loads again.
    let failDocumentGet = true;

    await page.route(/\**\/documents\/\**/, async (route) => {
      const request = route.request();
      if (
        failDocumentGet &&
        request.method().includes('GET') &&
        docId &&
        request.url().includes(`/documents/${docId}/`)
      ) {
        await route.fulfill({
          status: 500,
          json: { detail: 'Internal Server Error' },
        });
      } else {
        await route.continue();
      }
    });

    await page.reload();

    await expect(page).toHaveURL(/\/500\/?\?from=/, { timeout: 15000 });

    const refreshButton = page.getByRole('button', { name: 'Refresh page' });
    await expect(refreshButton).toBeVisible();

    failDocumentGet = false;
    await refreshButton.click();

    await verifyDocName(page, docTitle);
  });

  test('checks 404 on docs/[id] page', async ({ page }) => {
    await page.waitForTimeout(300);

    await page.goto('/docs/some-unknown-doc');
    await expect(
      page.getByText(
        'It seems that the page you are looking for does not exist or cannot be displayed correctly.',
      ),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('checks 401 on docs/[id] page', async ({ page, browserName }) => {
    const currentConfig = await getCurrentConfig(page);

    test.skip(
      currentConfig.FRONTEND_SILENT_LOGIN_ENABLED,
      'This test is only relevant when silent login is disabled.',
    );

    const [docTitle] = await createDoc(page, '401-doc', browserName, 1);
    await verifyDocName(page, docTitle);

    await writeInEditor({ page, text: 'Hello World' });

    /**
     * The session dies underneath an open document: the backend answers 401 to the
     * next thing the page asks it about the document.
     *
     * That next request used to arrive by itself. Leaving a document sent a
     * `PATCH .../content/` to save it - which is what this test used to intercept,
     * navigating to another document to provoke it. Content is no longer saved over
     * the api at all, so nothing is sent on the way out any more and the reload
     * below is what puts a question to the backend.
     */
    await page.route(/.*\/documents\/.*\/$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 401,
        json: {
          detail: 'Log in to access the document',
        },
      });
    });

    await page.reload();

    await expect(page.getByText('Log in to access the document.')).toBeVisible({
      timeout: 10000,
    });

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    );
    await expect(page).toHaveTitle(/401 Unauthorized - Docs/);
  });

  test('checks redirect if unsync version', async ({ page }) => {
    await overrideConfig(page, {
      RELEASE_VERSION: '0.0.0',
    });

    let counterReload = 0;
    await page.route(/.*\/users\/me\/$/, async (route) => {
      counterReload += 1;
      await route.continue();
    });

    await page.waitForTimeout(1000);

    // The sessionStorage guard should be set to the mismatched backend version.
    const reloadVersion = await page.evaluate(() =>
      sessionStorage.getItem('reload-version'),
    );
    expect(reloadVersion).toBe('0.0.0');

    // The page should have reloaded once
    expect(counterReload).toBe(2);
  });
});

test.describe('Doc Routing: Not logged', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('checks redirect to a doc after login', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    await SignIn(page, browserName);

    const [docTitle1] = await createDoc(page, 'doc-login-1', browserName, 1);
    await verifyDocName(page, docTitle1);

    const page2 = await page.context().newPage();
    await page2.goto('/');
    const [docTitle2] = await createDoc(page2, 'doc-login-2', browserName, 1);
    await verifyDocName(page2, docTitle2);

    // Remove cookies `docs_sessionid` to simulate the user being logged out
    await page2.context().clearCookies();
    await page2.reload();

    // Tab 2 - 401 triggered, user should be redirected to login page
    await expect(
      page2
        .getByRole('main', { name: 'Main content' })
        .getByRole('button', { name: 'Login' }),
    ).toBeVisible({
      timeout: 10000,
    });

    // Tab 1 - 401 triggered, user should be redirected to login page
    await page.reload();
    await expect(
      page
        .getByRole('main', { name: 'Main content' })
        .getByRole('button', { name: 'Login' }),
    ).toBeVisible({
      timeout: 10000,
    });

    // Reconnected
    await page
      .getByRole('main', { name: 'Main content' })
      .getByRole('button', { name: 'Login' })
      .click();
    await SignIn(page, browserName, false);

    // Tab 1 - Should be on its doc
    await verifyDocName(page, docTitle1);

    // Tab 2 - Should be on its doc
    await page2.reload();
    await verifyDocName(page2, docTitle2);
  });

  // eslint-disable-next-line playwright/expect-expect
  test('The homepage redirects to login.', async ({ page }) => {
    await page.goto('/');
    await expectLoginPage(page);
  });
});
