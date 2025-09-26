import crypto from 'crypto';

import { expect, test } from '@playwright/test';

import {
  createDoc,
  expectLoginPage,
  keyCloakSignIn,
  mockedDocument,
  verifyDocName,
} from './utils-common';
import { createRootSubPage } from './utils-sub-pages';

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

    const buttonCreateHomepage = page.getByRole('button', {
      name: 'New doc',
    });

    await expect(buttonCreateHomepage).toBeVisible();

    await page.goto('/docs/');
    await expect(buttonCreateHomepage).toBeVisible();
    await expect(page).toHaveURL(/\/docs\/$/);
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
    const [docTitle] = await createDoc(page, '401-doc-parent', browserName, 1);
    await verifyDocName(page, docTitle);

    await createRootSubPage(page, browserName, '401-doc-child');

    await page.locator('.ProseMirror.bn-editor').fill('Hello World');

    // Wait for the doc link (via its dynamic title) to be visible
    const docLink = page.getByRole('link', { name: docTitle });
    await expect(docLink).toBeVisible();

    // Intercept GET/PATCH requests to return 401
    await page.route(/.*\/documents\/.*\/$|users\/me\/$/, async (route) => {
      const request = route.request();
      if (
        request.method().includes('PATCH') ||
        request.method().includes('GET')
      ) {
        await route.fulfill({
          status: 401,
          json: { detail: 'Log in to access the document' },
        });
      } else {
        await route.continue();
      }
    });

    // Explicitly wait for a 401 response after clicking
    const wait401 = page.waitForResponse(
      (resp) =>
        resp.status() === 401 &&
        /\/(documents\/[^/]+\/|users\/me\/)$/.test(resp.url()),
    );

    await docLink.click();
    await wait401;

    await expect(page.getByText('Log in to access the document.')).toBeVisible({
      timeout: 10000,
    });

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    );
    await expect(page).toHaveTitle(/401 Unauthorized - Docs/);
  });
});

test.describe('Doc Routing: Not logged', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('checks redirect to a doc after login', async ({
    page,
    browserName,
  }) => {
    const uuid = crypto.randomUUID();
    await mockedDocument(page, { link_reach: 'public', id: uuid });
    await page.goto(`/docs/${uuid}/`);
    await expect(page.locator('h2').getByText('Mocked document')).toBeVisible();
    await page.getByRole('button', { name: 'Login' }).click();
    await keyCloakSignIn(page, browserName, false);
    await expect(page.locator('h2').getByText('Mocked document')).toBeVisible();
  });

  // eslint-disable-next-line playwright/expect-expect
  test('The homepage redirects to login.', async ({ page }) => {
    await page.goto('/');
    await expectLoginPage(page);
  });
});
