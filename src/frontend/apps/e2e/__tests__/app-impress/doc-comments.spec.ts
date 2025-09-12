import { chromium, expect, test } from '@playwright/test';

import {
  BROWSERS,
  createDoc,
  keyCloakSignIn,
  verifyDocName,
} from './utils-common';
import { addNewMember } from './utils-share';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Comments', () => {
  test('it checks comments with 2 users in real time', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(page, 'comment-doc', browserName, 1);

    // We share the doc with another user
    const otherBrowserName = BROWSERS.find((b) => b !== browserName);
    if (!otherBrowserName) {
      throw new Error('No alternative browser found');
    }
    await page.getByRole('button', { name: 'Share' }).click();
    await addNewMember(page, 1, 'Administrator', otherBrowserName);

    await expect(
      page
        .getByRole('listbox', { name: 'Suggestions' })
        .getByText(new RegExp(otherBrowserName)),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    // We add a comment with the first user
    const editor = page.locator('.ProseMirror');
    await editor.locator('.bn-block-outer').last().fill('Hello World');
    await editor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Add comment' }).click();

    const thread = page.locator('.bn-thread');
    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();
    await editor.getByText('Hello').click();

    await expect(thread.getByText('This is a comment').first()).toBeVisible();
    await expect(thread.getByText(`E2E ${browserName}`).first()).toBeVisible();

    const urlCommentDoc = page.url();

    /**
     * We open another browser that will connect to the collaborative server
     * and will block the current browser to edit the doc.
     */
    const otherBrowser = await chromium.launch({ headless: true });
    const otherContext = await otherBrowser.newContext({
      locale: 'en-US',
      timezoneId: 'Europe/Paris',
      permissions: [],
      storageState: {
        cookies: [],
        origins: [],
      },
    });
    const otherPage = await otherContext.newPage();
    await otherPage.goto(urlCommentDoc);

    await otherPage.getByRole('button', { name: 'Login' }).click({
      timeout: 15000,
    });

    await keyCloakSignIn(otherPage, otherBrowserName, false);

    await verifyDocName(otherPage, docTitle);

    const otherEditor = otherPage.locator('.ProseMirror');
    await otherEditor.getByText('Hello').click();
    const otherThread = otherPage.locator('.bn-thread');

    // We check that the comment made by the first user is visible for the second user
    await expect(
      otherThread.getByText('This is a comment').first(),
    ).toBeVisible();
    await expect(
      otherThread.getByText(`E2E ${browserName}`).first(),
    ).toBeVisible();

    // We add a comment with the second user
    await otherThread
      .getByRole('paragraph')
      .last()
      .fill('This is a comment from the other user');
    await otherThread.locator('[data-test="save"]').click();

    // We check that the second user can see his comment he just made
    await expect(
      otherThread.getByText('This is a comment from the other user').first(),
    ).toBeVisible();
    await expect(
      otherThread.getByText(`E2E ${otherBrowserName}`).first(),
    ).toBeVisible();

    // We check that the first user can see the comment made by the second user in real time
    await expect(
      thread.getByText('This is a comment from the other user').first(),
    ).toBeVisible();
    await expect(
      thread.getByText(`E2E ${otherBrowserName}`).first(),
    ).toBeVisible();
  });

  test('it checks the comments interactions', async ({
    page,
    browserName,
  }) => {});
});
