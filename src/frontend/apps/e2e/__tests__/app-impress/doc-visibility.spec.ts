import { expect, test } from '@playwright/test';

import {
  BROWSERS,
  createDoc,
  expectLoginPage,
  keyCloakSignIn,
  verifyDocName,
} from './utils-common';
import { getEditor, writeInEditor } from './utils-editor';
import { addNewMember, connectOtherUserToDoc } from './utils-share';
import { createRootSubPage } from './utils-sub-pages';

test.describe('Doc Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('It checks the copy link button', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'navigator.clipboard is not working with webkit and playwright',
    );

    await createDoc(page, 'My button copy doc', browserName, 1);

    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();

    await expect(page.getByText('Link Copied !')).toBeVisible();

    const handle = await page.evaluateHandle(() =>
      navigator.clipboard.readText(),
    );
    const clipboardContent = await handle.jsonValue();

    expect(clipboardContent).toMatch(page.url());
  });

  test('It checks the link role options', async ({ page, browserName }) => {
    await createDoc(page, 'Doc role options', browserName, 1);

    await page.getByRole('button', { name: 'Share' }).click();

    const selectVisibility = page.getByTestId('doc-visibility');

    await expect(selectVisibility.getByText('Private')).toBeVisible();

    await expect(
      page.getByRole('menuitem', { name: 'Read only' }),
    ).toBeHidden();
    await expect(
      page.getByRole('menuitem', { name: 'Can read and edit' }),
    ).toBeHidden();

    await selectVisibility.click();
    await page.getByRole('menuitem', { name: 'Connected' }).click();

    await expect(page.getByTestId('doc-access-mode')).toBeVisible();

    await selectVisibility.click();

    await page.getByRole('menuitem', { name: 'Public' }).click();

    await expect(page.getByTestId('doc-access-mode')).toBeVisible();
  });
});

test.describe('Doc Visibility: Restricted', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('A doc is not accessible when not authentified.', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    const [docTitle] = await createDoc(
      page,
      'Restricted no auth',
      browserName,
      1,
    );

    await verifyDocName(page, docTitle);

    const urlDoc = page.url();

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    await expectLoginPage(page);

    await page.goto(urlDoc);

    await expect(
      page.getByText('Log in to access the document.'),
    ).toBeVisible();
  });

  test('A doc is not accessible when authentified but not member.', async ({
    page,
    browserName,
  }) => {
    test.slow();

    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    const [docTitle] = await createDoc(page, 'Restricted auth', browserName, 1);

    await verifyDocName(page, docTitle);

    const urlDoc = page.url();

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    const otherBrowser = BROWSERS.find((b) => b !== browserName);
    if (!otherBrowser) {
      throw new Error('No alternative browser found');
    }

    await keyCloakSignIn(page, otherBrowser);

    await expect(page.getByTestId('header-logo-link')).toBeVisible({
      timeout: 10000,
    });

    await page.goto(urlDoc);

    await expect(
      page.getByText('Insufficient access rights to view the document.'),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('A doc is accessible when member.', async ({ page, browserName }) => {
    test.slow();
    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    const [docTitle] = await createDoc(page, 'Restricted auth', browserName, 1);

    await verifyDocName(page, docTitle);

    await writeInEditor({ page, text: 'Hello World' });

    const docUrl = page.url();

    const { otherBrowserName, otherPage, cleanup } =
      await connectOtherUserToDoc({
        browserName,
        docUrl,
      });

    await expect(
      otherPage.getByText('Insufficient access rights to view the document.'),
    ).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: 'Share' }).click();

    await addNewMember(page, 0, 'Reader', otherBrowserName);

    await otherPage.reload();
    await expect(otherPage.getByText('Hello World')).toBeVisible({
      timeout: 10000,
    });

    await cleanup();
  });
});

test.describe('Doc Visibility: Public', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('It checks a public doc in read only mode', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(
      page,
      'Public read only',
      browserName,
      1,
    );

    await verifyDocName(page, docTitle);

    await writeInEditor({ page, text: 'Hello Public Viewonly' });

    await page.getByRole('button', { name: 'Share' }).click();
    const selectVisibility = page.getByTestId('doc-visibility');
    await selectVisibility.click();

    await page
      .getByRole('menuitem', {
        name: 'Public',
      })
      .click();

    await expect(
      page.getByText('The document visibility has been updated.'),
    ).toBeVisible();

    await expect(page.getByTestId('doc-access-mode')).toBeVisible();
    await page.getByTestId('doc-access-mode').click();
    await page
      .getByRole('menuitem', {
        name: 'Reading',
      })
      .click();

    await expect(
      page.getByText('The document visibility has been updated.').first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    const cardContainer = page.getByLabel(
      'It is the card information about the document.',
    );

    await expect(cardContainer.getByTestId('public-icon')).toBeVisible();

    await expect(
      cardContainer.getByText('Public document', { exact: true }),
    ).toBeVisible();

    await expect(page.getByTestId('search-docs-button')).toBeVisible();
    await expect(page.getByTestId('new-doc-button')).toBeVisible();

    const docUrl = page.url();

    const { otherPage, cleanup } = await connectOtherUserToDoc({
      browserName,
      docUrl,
      withoutSignIn: true,
    });

    await expect(otherPage.locator('h2').getByText(docTitle)).toBeVisible();
    await expect(otherPage.getByTestId('search-docs-button')).toBeHidden();
    await expect(otherPage.getByTestId('new-doc-button')).toBeHidden();
    await expect(
      otherPage.getByRole('button', { name: 'Share' }),
    ).toBeVisible();
    const card = otherPage.getByLabel('It is the card information');
    await expect(card).toBeVisible();
    await expect(card.getByText('Reader')).toBeVisible();

    await expect(
      otherPage.locator('.--docs--editor-container.--docs--doc-readonly'),
    ).toBeVisible();

    const otherEditor = await getEditor({ page: otherPage });
    await expect(otherEditor).toHaveAttribute('contenteditable', 'false');
    await expect(otherEditor.getByText('Hello Public Viewonly')).toBeVisible();

    // Cursor and selection of the anonymous user are not visible
    await otherEditor.getByText('Hello Public').selectText();
    await expect(
      page.locator('.collaboration-cursor-custom__base'),
    ).toBeHidden();
    await expect(page.locator('.ProseMirror-yjs-selection')).toBeHidden();

    // Can still see changes made by others
    await writeInEditor({ page, text: 'Can you see it ?' });
    await expect(otherEditor.getByText('Can you see it ?')).toBeVisible();

    await otherPage.getByRole('button', { name: 'Share' }).click();
    await expect(
      otherPage.getByText(
        'You can view this document but need additional access to see its members or modify settings.',
      ),
    ).toBeVisible();

    await expect(
      otherPage.getByRole('button', { name: 'Request access' }),
    ).toBeHidden();

    await cleanup();
  });

  test('It checks a public doc in editable mode', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(page, 'Public editable', browserName, 1);

    await verifyDocName(page, docTitle);

    await writeInEditor({ page, text: 'Hello Public Editable' });

    await page.getByRole('button', { name: 'Share' }).click();
    const selectVisibility = page.getByTestId('doc-visibility');
    await selectVisibility.click();

    await page
      .getByRole('menuitem', {
        name: 'Public',
      })
      .click();

    await expect(
      page.getByText('The document visibility has been updated.'),
    ).toBeVisible();

    await page.getByTestId('doc-access-mode').click();
    await page.getByRole('menuitem', { name: 'Editing' }).click();

    await expect(
      page.getByText('The document visibility has been updated.').first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    const cardContainer = page.getByLabel(
      'It is the card information about the document.',
    );

    await expect(cardContainer.getByTestId('public-icon')).toBeVisible();

    await expect(
      cardContainer.getByText('Public document', { exact: true }),
    ).toBeVisible();

    const docUrl = page.url();

    const { otherPage, cleanup } = await connectOtherUserToDoc({
      browserName,
      docUrl,
      withoutSignIn: true,
      docTitle,
    });

    await expect(otherPage.getByTestId('search-docs-button')).toBeHidden();
    await expect(otherPage.getByTestId('new-doc-button')).toBeHidden();

    const otherEditor = await getEditor({ page: otherPage });
    await expect(otherEditor).toHaveAttribute('contenteditable', 'true');
    await expect(otherEditor.getByText('Hello Public Editable')).toBeVisible();

    // We can see the collaboration cursor of the anonymous user
    await otherEditor.getByText('Hello Public').selectText();
    await expect(
      page.locator('.collaboration-cursor-custom__base').getByText('Anonymous'),
    ).toBeVisible();

    await expect(
      otherPage.getByRole('button', { name: 'Share' }),
    ).toBeVisible();
    const card = otherPage.getByLabel('It is the card information');
    await expect(card).toBeVisible();
    await expect(card.getByText('Editor')).toBeVisible();

    await otherPage.getByRole('button', { name: 'Share' }).click();
    await expect(
      otherPage.getByText(
        'You can view this document but need additional access to see its members or modify settings.',
      ),
    ).toBeVisible();

    await expect(
      otherPage.getByRole('button', { name: 'Request access' }),
    ).toBeHidden();

    await cleanup();
  });
});

test.describe('Doc Visibility: Authenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('A doc is not accessible when unauthenticated.', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    const [docTitle] = await createDoc(
      page,
      'Authenticated unauthentified',
      browserName,
      1,
    );

    await verifyDocName(page, docTitle);

    await page.getByRole('button', { name: 'Share' }).click();
    const selectVisibility = page.getByTestId('doc-visibility');
    await selectVisibility.click();
    await page
      .getByRole('menuitem', {
        name: 'Connected',
      })
      .click();

    await expect(
      page.getByText('The document visibility has been updated.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    const urlDoc = page.url();

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    await expectLoginPage(page);

    await page.goto(urlDoc);

    await expect(page.locator('h2').getByText(docTitle)).toBeHidden();

    await expect(
      page.getByText('Log in to access the document.'),
    ).toBeVisible();
  });

  test('It checks a authenticated doc in read only mode', async ({
    page,
    browserName,
  }) => {
    test.slow();

    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    const [docTitle] = await createDoc(
      page,
      'Authenticated read only',
      browserName,
      1,
    );

    await verifyDocName(page, docTitle);

    await page.getByRole('button', { name: 'Share' }).click();
    const selectVisibility = page.getByTestId('doc-visibility');
    await selectVisibility.click();
    await page
      .getByRole('menuitem', {
        name: 'Connected',
      })
      .click();

    await expect(
      page.getByText('The document visibility has been updated.'),
    ).toBeVisible();

    await expect(
      page
        .getByLabel('It is the card information about the document.')
        .getByText('Document accessible to any connected person', {
          exact: true,
        }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    const urlDoc = page.url();

    const { name: childTitle } = await createRootSubPage(
      page,
      browserName,
      'Authenticated read only - child',
    );

    const urlChildDoc = page.url();

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    const otherBrowser = BROWSERS.find((b) => b !== browserName);
    if (!otherBrowser) {
      throw new Error('No alternative browser found');
    }
    await keyCloakSignIn(page, otherBrowser);

    await expect(page.getByTestId('header-logo-link')).toBeVisible({
      timeout: 10000,
    });

    await page.goto(urlDoc);

    await expect(page.locator('h2').getByText(docTitle)).toBeVisible();
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Link Copied !')).toBeVisible();

    await expect(
      page.getByText(
        'You can view this document but need additional access to see its members or modify settings.',
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Request access' }).click();

    await expect(
      page.getByRole('button', { name: 'Request access' }),
    ).toBeDisabled();

    await page.goto(urlChildDoc);

    await expect(page.locator('h2').getByText(childTitle)).toBeVisible();

    await page.getByRole('button', { name: 'Share' }).click();

    await expect(
      page.getByText(
        'As this is a sub-document, please request access to the parent document to enable these features.',
      ),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Request access' }),
    ).toBeHidden();
  });

  test('It checks a authenticated doc in editable mode', async ({
    page,
    browserName,
  }) => {
    test.slow();
    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    const [docTitle] = await createDoc(
      page,
      'Authenticated editable',
      browserName,
      1,
    );

    await verifyDocName(page, docTitle);

    await page.getByRole('button', { name: 'Share' }).click();
    const selectVisibility = page.getByTestId('doc-visibility');
    await selectVisibility.click();
    await page
      .getByRole('menuitem', {
        name: 'Connected',
      })
      .click();

    await expect(
      page.getByText('The document visibility has been updated.'),
    ).toBeVisible();

    const urlDoc = page.url();
    await page.getByTestId('doc-access-mode').click();
    await page.getByRole('menuitem', { name: 'Editing' }).click();

    await expect(
      page.getByText('The document visibility has been updated.').first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    const otherBrowser = BROWSERS.find((b) => b !== browserName);
    if (!otherBrowser) {
      throw new Error('No alternative browser found');
    }
    await keyCloakSignIn(page, otherBrowser);

    await expect(page.getByTestId('header-logo-link')).toBeVisible({
      timeout: 10000,
    });

    await page.goto(urlDoc);

    await verifyDocName(page, docTitle);
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Link Copied !')).toBeVisible({
      timeout: 10000,
    });
  });
});
