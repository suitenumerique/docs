import { expect, test } from '@playwright/test';

import { createDoc, getOtherBrowserName, verifyDocName } from './utils-common';
import { writeInEditor } from './utils-editor';
import {
  addNewMember,
  connectOtherUserToDoc,
  updateRoleUser,
  updateShareLink,
} from './utils-share';

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
    const otherBrowserName = getOtherBrowserName(browserName);
    await page.getByRole('button', { name: 'Share' }).click();
    await addNewMember(page, 0, 'Administrator', otherBrowserName);

    await expect(
      page
        .getByRole('listbox', { name: 'Suggestions' })
        .getByText(new RegExp(otherBrowserName)),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    // We add a comment with the first user
    const editor = await writeInEditor({ page, text: 'Hello World' });
    await editor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Comment' }).click();

    const thread = page.locator('.bn-thread');
    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();
    await expect(thread.getByText('This is a comment').first()).toBeHidden();

    await editor.getByText('Hello').click();

    await thread.getByText('This is a comment').first().hover();

    // We add a reaction with the first user
    await thread.locator('[data-test="addreaction"]').first().click();
    await thread.getByRole('button', { name: '👍' }).click();

    await expect(
      thread.getByRole('img', { name: 'E2E Chromium' }).first(),
    ).toBeVisible();
    await expect(thread.getByText('This is a comment').first()).toBeVisible();
    await expect(thread.getByText(`E2E ${browserName}`).first()).toBeVisible();
    await expect(thread.locator('.bn-comment-reaction')).toHaveText('👍1');

    const urlCommentDoc = page.url();

    const { otherPage, cleanup } = await connectOtherUserToDoc({
      otherBrowserName,
      docUrl: urlCommentDoc,
      docTitle,
    });

    const otherEditor = otherPage.locator('.ProseMirror');
    await otherEditor.getByText('Hello').click();
    const otherThread = otherPage.locator('.bn-thread');

    await otherThread.getByText('This is a comment').first().hover();
    await otherThread.locator('[data-test="addreaction"]').first().click();
    await otherThread.getByRole('button', { name: '👍' }).click();

    // We check that the comment made by the first user is visible for the second user
    await expect(
      otherThread.getByText('This is a comment').first(),
    ).toBeVisible();
    await expect(
      otherThread.getByText(`E2E ${browserName}`).first(),
    ).toBeVisible();
    await expect(otherThread.locator('.bn-comment-reaction')).toHaveText('👍2');

    // We add a comment with the second user
    await otherThread
      .getByRole('paragraph')
      .last()
      .fill('This is a comment from the other user');
    await otherThread.locator('[data-test="save"]').click();

    // We check that the second user can see the comment he just made
    await expect(
      otherThread.getByRole('img', { name: `E2E ${otherBrowserName}` }).first(),
    ).toBeVisible();
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

    await cleanup();
  });

  test('it checks the comments interactions', async ({ page, browserName }) => {
    await createDoc(page, 'comment-interaction', browserName, 1);

    // Checks add react reaction
    const editor = page.locator('.ProseMirror');
    await editor.locator('.bn-block-outer').last().fill('Hello World');
    await editor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Comment' }).click();

    const thread = page.locator('.bn-thread');
    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();
    await expect(thread.getByText('This is a comment').first()).toBeHidden();

    // Check background color changed
    await expect(editor.getByText('Hello')).toHaveCSS(
      'background-color',
      'rgba(237, 180, 0, 0.4)',
    );
    await editor.getByText('Hello').click();

    await thread.getByText('This is a comment').first().hover();

    // We add a reaction with the first user
    await thread.locator('[data-test="addreaction"]').first().click();
    await thread.getByRole('button', { name: '👍' }).click();

    await expect(thread.locator('.bn-comment-reaction')).toHaveText('👍1');

    // Edit Comment
    await thread.getByText('This is a comment').first().hover();
    await thread.locator('[data-test="moreactions"]').first().click();
    await thread.getByRole('menuitem', { name: 'Edit comment' }).click();
    const commentEditor = thread.getByText('This is a comment').first();
    await commentEditor.fill('This is an edited comment');
    const saveBtn = thread.getByRole('button', { name: 'Save' });
    await saveBtn.click();
    await expect(saveBtn).toBeHidden();
    await expect(
      thread.getByText('This is an edited comment').first(),
    ).toBeVisible();
    await expect(thread.getByText('This is a comment').first()).toBeHidden();

    // Add second comment
    await thread.getByRole('paragraph').last().fill('This is a second comment');
    await thread.getByRole('button', { name: 'Save' }).click();
    await expect(
      thread.getByText('This is an edited comment').first(),
    ).toBeVisible();
    await expect(
      thread.getByText('This is a second comment').first(),
    ).toBeVisible();

    // Delete second comment
    await thread.getByText('This is a second comment').first().hover();
    await thread.locator('[data-test="moreactions"]').first().click();
    await thread.getByRole('menuitem', { name: 'Delete comment' }).click();
    await expect(
      thread.getByText('This is a second comment').first(),
    ).toBeHidden();

    // Resolve thread
    await thread.getByText('This is an edited comment').first().hover();
    await thread.locator('[data-test="resolve"]').click();
    await expect(thread).toBeHidden();
    await expect(editor.getByText('Hello')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
  });

  test('it checks the comments abilities', async ({ page, browserName }) => {
    test.slow();

    const [docTitle] = await createDoc(page, 'comment-doc', browserName, 1);

    // We share the doc with another user
    const otherBrowserName = getOtherBrowserName(browserName);

    // Add a new member with editor role
    await page.getByRole('button', { name: 'Share' }).click();
    await addNewMember(page, 0, 'Editor', otherBrowserName);

    await expect(
      page
        .getByRole('listbox', { name: 'Suggestions' })
        .getByText(new RegExp(otherBrowserName)),
    ).toBeVisible();

    const urlCommentDoc = page.url();

    const { otherPage, cleanup } = await connectOtherUserToDoc({
      otherBrowserName,
      docUrl: urlCommentDoc,
      docTitle,
    });

    const otherEditor = await writeInEditor({
      page: otherPage,
      text: 'Hello, I can edit the document',
    });
    await expect(
      otherEditor.getByText('Hello, I can edit the document'),
    ).toBeVisible();
    await otherEditor.getByText('Hello').selectText();
    await otherPage.getByRole('button', { name: 'Comment' }).click();
    const otherThread = otherPage.locator('.bn-thread');
    await otherThread
      .getByRole('paragraph')
      .first()
      .fill('I can add a comment');
    await otherThread.locator('[data-test="save"]').click();
    await expect(
      otherThread.getByText('I can add a comment').first(),
    ).toBeHidden();

    await expect(otherEditor.getByText('Hello')).toHaveCSS(
      'background-color',
      'rgba(237, 180, 0, 0.4)',
    );

    // We change the role of the second user to reader
    updateRoleUser(page, 'Reader', `user.test@${otherBrowserName}.test`);

    // With the reader role, the second user cannot see comments
    await otherPage.reload();
    await verifyDocName(otherPage, docTitle);

    await expect(otherEditor.getByText('Hello')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await otherEditor.getByText('Hello').click();
    await expect(otherThread).toBeHidden();
    await otherEditor.getByText('Hello').selectText();
    await expect(
      otherPage.getByRole('button', { name: 'Comment' }),
    ).toBeHidden();

    await otherPage.reload();

    // Change the link role of the doc to set it in commenting mode
    updateShareLink(page, 'Public', 'Editing');

    // Anonymous user can see and add comments
    await otherPage.getByRole('button', { name: 'Logout' }).click();

    await otherPage.goto(urlCommentDoc);

    await verifyDocName(otherPage, docTitle);

    await expect(otherEditor.getByText('Hello')).toHaveCSS(
      'background-color',
      'rgba(237, 180, 0, 0.4)',
    );
    await otherEditor.getByText('Hello').click();
    await expect(
      otherThread.getByText('I can add a comment').first(),
    ).toBeVisible();

    await otherThread
      .locator('.ProseMirror.bn-editor[contenteditable="true"]')
      .getByRole('paragraph')
      .first()
      .fill('Comment by anonymous user');
    await otherThread.locator('[data-test="save"]').click();

    await expect(
      otherThread.getByText('Comment by anonymous user').first(),
    ).toBeVisible();

    await expect(
      otherThread.getByRole('img', { name: `Anonymous` }).first(),
    ).toBeVisible();

    await otherThread.getByText('Comment by anonymous user').first().hover();
    await expect(otherThread.locator('[data-test="moreactions"]')).toBeHidden();

    await cleanup();
  });
});
