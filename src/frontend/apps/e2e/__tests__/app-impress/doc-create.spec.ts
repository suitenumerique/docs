import { expect, test } from '@playwright/test';

import {
  createDoc,
  goToGridDoc,
  randomName,
  verifyDocName,
} from './utils-common';
import { openSuggestionMenu } from './utils-editor';
import { connectOtherUserToDoc } from './utils-share';
import { SignIn } from './utils-signin';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Create', () => {
  test('it creates a doc', async ({ page, browserName }) => {
    const [docTitle] = await createDoc(page, 'my-new-doc', browserName, 1);

    await page.waitForFunction(
      () => document.title.match(/my-new-doc - Docs/),
      { timeout: 5000 },
    );

    await page.getByRole('button', { name: 'Back to homepage' }).click();

    const docsGrid = page.getByTestId('docs-grid');
    await expect(docsGrid).toBeVisible();
    await expect(page.getByTestId('grid-loader')).toBeHidden();
    await expect(docsGrid.getByText(docTitle)).toBeVisible();
  });

  test('it creates a sub doc from slash menu editor', async ({
    page,
    browserName,
  }) => {
    const [title] = await createDoc(page, 'my-new-slash-doc', browserName, 1);

    await verifyDocName(page, title);

    await openSuggestionMenu({
      page,
      suggestion: 'New sub-doc',
    });

    const input = page.getByRole('textbox', { name: 'Document title' });
    await expect(input).toHaveText('', { timeout: 10000 });
    await expect(
      page.locator('.c__tree-view--row-content').getByText('Untitled document'),
    ).toBeVisible();
  });

  test('it creates a doc with link "/docs/new/"', async ({
    page,
    browserName,
  }) => {
    test.slow();

    // Private doc creation
    await page.goto('/docs/new/?title=My+private+doc+from+url');

    await verifyDocName(page, 'My private doc from url');

    await page.getByRole('button', { name: 'Share' }).click();

    await expect(
      page.getByTestId('doc-visibility').getByText('Private').first(),
    ).toBeVisible();

    // Public editing doc creation
    await page.goto(
      '/docs/new/?title=My+public+doc+from+url&link-reach=public&link-role=editor',
    );

    await verifyDocName(page, 'My public doc from url');

    await page.getByRole('button', { name: 'Share' }).click();

    await expect(
      page.getByTestId('doc-visibility').getByText('Public').first(),
    ).toBeVisible();

    await expect(
      page.getByTestId('doc-access-mode').getByText('Editing').first(),
    ).toBeVisible();

    // Authenticated reading doc creation
    await page.goto(
      '/docs/new/?title=My+authenticated+doc+from+url&link-reach=authenticated&link-role=reader',
    );

    await verifyDocName(page, 'My authenticated doc from url');

    await page.getByRole('button', { name: 'Share' }).click();

    await expect(
      page.getByTestId('doc-visibility').getByText('Connected').first(),
    ).toBeVisible();

    await expect(
      page.getByTestId('doc-access-mode').getByText('Reading').first(),
    ).toBeVisible();

    const { cleanup, otherPage, otherBrowserName } =
      await connectOtherUserToDoc({
        docUrl:
          '/docs/new/?title=From+unlogged+doc+from+url&link-reach=authenticated&link-role=reader',
        browserName,
        withoutSignIn: true,
      });

    await SignIn(otherPage, otherBrowserName, false);

    await verifyDocName(otherPage, 'From unlogged doc from url');

    await otherPage.getByRole('button', { name: 'Share' }).click();

    await expect(
      otherPage.getByTestId('doc-visibility').getByText('Connected').first(),
    ).toBeVisible();

    await expect(
      otherPage.getByTestId('doc-access-mode').getByText('Reading').first(),
    ).toBeVisible();

    await cleanup();
  });
});

test.describe('Doc Create: Not logged', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('it creates a doc server way', async ({
    page,
    browserName,
    request,
  }) => {
    test.skip(
      !process.env.SERVER_TO_SERVER_API_TOKENS ||
        !process.env[`SUB_${browserName.toUpperCase()}`] ||
        !process.env[`SIGN_IN_USERNAME_${browserName.toUpperCase()}`],
      'Server to server API tokens and credentials must be set',
    );

    const markdown = `This is a normal text\n\n# And this is a large heading`;
    const [title] = randomName('My server way doc create', browserName, 1);
    const data = {
      title,
      content: markdown,
      sub: process.env[`SUB_${browserName.toUpperCase()}`],
      email: process.env[`SIGN_IN_USERNAME_${browserName.toUpperCase()}`],
    };

    const newDoc = await request.post(
      `${process.env.BASE_API_URL}/documents/create-for-owner/`,
      {
        data,
        headers: {
          Authorization: `Bearer ${process.env.SERVER_TO_SERVER_API_TOKENS}`,
          format: 'json',
        },
      },
    );

    expect(newDoc.ok()).toBeTruthy();

    await SignIn(page, browserName);

    await goToGridDoc(page, { title });

    await verifyDocName(page, title);

    const editor = page.locator('.ProseMirror');
    await expect(editor.getByText('This is a normal text')).toBeVisible();
    await expect(
      editor.locator('h1').getByText('And this is a large heading'),
    ).toBeVisible();
  });
});
