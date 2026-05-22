import { expect, test } from '@playwright/test';

import {
  closeHeaderMenu,
  createDoc,
  getOtherBrowserName,
  verifyDocName,
} from './utils-common';
import {
  getEditor,
  tryFocusEditorContent,
  writeInEditor,
} from './utils-editor';
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
    await page.getByRole('button', { name: 'Add comment' }).click();

    const thread = page.locator('.bn-thread');
    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();
    await expect(thread.getByText('This is a comment').first()).toBeHidden();

    await editor.first().click();
    await editor.getByText('Hello').click();

    await thread.getByText('This is a comment').first().hover();

    // We add a reaction with the first user
    await thread.locator('[data-test="addreaction"]').first().click();
    await page.getByRole('button', { name: '👍' }).click();

    await expect(
      thread
        .getByRole('img', { name: `${process.env.FIRST_NAME} ${browserName}` })
        .first(),
    ).toBeVisible();
    await expect(thread.getByText('This is a comment').first()).toBeVisible();
    await expect(
      thread.getByText(`${process.env.FIRST_NAME} ${browserName}`).first(),
    ).toBeVisible();
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
    await otherPage.getByRole('button', { name: '👍' }).click();

    // We check that the comment made by the first user is visible for the second user
    await expect(
      otherThread.getByText('This is a comment').first(),
    ).toBeVisible();
    await expect(
      otherThread.getByText(`${process.env.FIRST_NAME} ${browserName}`).first(),
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
      otherThread
        .getByRole('img', {
          name: `${process.env.FIRST_NAME} ${otherBrowserName}`,
        })
        .first(),
    ).toBeVisible();
    await expect(
      otherThread.getByText('This is a comment from the other user').first(),
    ).toBeVisible();
    await expect(
      otherThread
        .getByText(`${process.env.FIRST_NAME} ${otherBrowserName}`)
        .first(),
    ).toBeVisible();

    // We check that the first user can see the comment made by the second user in real time
    await expect(
      thread.getByText('This is a comment from the other user').first(),
    ).toBeVisible();
    await expect(
      thread.getByText(`${process.env.FIRST_NAME} ${otherBrowserName}`).first(),
    ).toBeVisible();

    await cleanup();
  });

  test('it checks the comments interactions', async ({ page, browserName }) => {
    await createDoc(page, 'comment-interaction', browserName, 1);

    // Checks add react reaction
    const editor = await writeInEditor({ page, text: 'Hello' });
    await editor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Add comment' }).click();

    const thread = page.locator('.bn-thread');
    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();
    await expect(thread.getByText('This is a comment').first()).toBeHidden();
    await expect(editor.getByText('Hello')).toHaveClass('bn-thread-mark');

    await expect(editor.getByText('Hello')).toHaveCSS(
      'background-color',
      /color\(srgb\s+[\d\s.]+\s+\/\s+0\.4\)/,
    );

    await editor.first().click();
    await editor.getByText('Hello').click();

    await thread.getByText('This is a comment').first().hover();

    // We add a reaction with the first user
    await thread.locator('[data-test="addreaction"]').first().click();
    await page.getByRole('button', { name: '👍' }).click();

    await expect(thread.locator('.bn-comment-reaction')).toHaveText('👍1');

    // Edit Comment
    await thread.getByText('This is a comment').first().hover();
    await thread.locator('[data-test="moreactions"]').first().click();
    await thread.getByRole('menuitem', { name: 'Edit comment' }).click();
    const commentEditor = thread.getByText('This is a comment').first();
    await commentEditor.fill('This is an edited comment');
    const saveBtn = thread.locator('button[data-test="save"]').first();
    await saveBtn.click();
    await expect(saveBtn).toBeHidden();
    await expect(
      thread.getByText('This is an edited comment').first(),
    ).toBeVisible();
    await expect(thread.getByText('This is a comment').first()).toBeHidden();

    // Add second comment
    await thread.getByRole('paragraph').last().fill('This is a second comment');
    await saveBtn.click();
    await expect(saveBtn).toBeHidden();
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

    /* Delete the last comment remove the thread */
    await editor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Add comment' }).click();

    await thread.getByRole('paragraph').first().fill('This is a new comment');
    await thread.locator('[data-test="save"]').click();
    await expect(editor.getByText('Hello')).toHaveClass('bn-thread-mark');

    await expect(editor.getByText('Hello')).toHaveCSS(
      'background-color',
      /color\(srgb\s+[\d\s.]+\s+\/\s+0\.4\)/,
    );

    await editor.first().click();
    await editor.getByText('Hello').click();

    await thread.getByText('This is a new comment').first().hover();
    await thread.locator('[data-test="moreactions"]').first().click();
    await thread.getByRole('menuitem', { name: 'Delete comment' }).click();

    await expect(editor.getByText('Hello')).not.toHaveClass('bn-thread-mark');
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

    const editor = await getEditor({ page });

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
      editor.getByText('Hello, I can edit the document'),
    ).toBeVisible();
    await otherEditor.getByText('Hello').selectText();
    await otherPage.getByRole('button', { name: 'Add comment' }).click();
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
      /color\(srgb\s+[\d\s.]+\s+\/\s+0\.4\)/,
    );

    // We change the role of the second user to reader
    await updateRoleUser(
      page,
      'Reader',
      process.env[`SIGN_IN_USERNAME_${otherBrowserName.toUpperCase()}`] || '',
    );

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
      otherPage.getByRole('button', { name: 'Add comment' }),
    ).toBeHidden();

    await otherPage.reload();

    // Change the link role of the doc to set it in commenting mode
    await updateShareLink(page, 'Public', 'Editing');

    // Anonymous user can see and add comments
    await otherPage.getByRole('button', { name: 'Logout' }).click();

    await expect(
      otherPage
        .getByRole('button', { name: process.env.SIGN_IN_EL_TRIGGER })
        .first(),
    ).toBeVisible({
      timeout: 10000,
    });

    await otherPage.goto(urlCommentDoc);

    await verifyDocName(otherPage, docTitle);

    await expect(otherEditor.getByText('Hello')).toHaveCSS(
      'background-color',
      /color\(srgb\s+[\d\s.]+\s+\/\s+0\.4\)/,
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

  test('it checks comments pasting from another document', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'comment-doc-1', browserName, 1);

    // We add a comment in the first document
    const editor1 = await writeInEditor({ page, text: 'Document One' });
    await editor1.getByText('Document One').selectText();
    await page.getByRole('button', { name: 'Add comment' }).click();

    const thread1 = page.locator('.bn-thread');
    await thread1.getByRole('paragraph').first().fill('Comment in Doc One');
    await thread1.locator('[data-test="save"]').click();
    await expect(thread1.getByText('Comment in Doc One').first()).toBeHidden();

    await expect(editor1.getByText('Document One')).toHaveCSS(
      'background-color',
      /color\(srgb\s+[\d\s.]+\s+\/\s+0\.4\)/,
    );

    await editor1.getByText('Document One').click();
    // We copy the content including the comment from the first document
    await editor1.getByText('Document One').selectText();
    await page.keyboard.press('Control+C');

    // We create a second document
    await createDoc(page, 'comment-doc-2', browserName, 1);

    // We paste the content into the second document
    const editor2 = await writeInEditor({ page, text: '' });
    await editor2.click();
    await page.keyboard.press('Control+V');

    await expect(editor2.getByText('Document One')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );

    await editor2.getByText('Document One').click();
    await expect(page.locator('.bn-thread')).toBeHidden();
  });
});

test.describe('Doc Comments mobile', () => {
  test.use({ viewport: { width: 500, height: 1200 } });

  test('Can comments on mobile', async ({ page, browserName }) => {
    const [title] = await createDoc(
      page,
      'comment-mobile',
      browserName,
      1,
      true,
    );

    await closeHeaderMenu(page);

    await verifyDocName(page, title);

    // Checks add react reaction
    const editor = await writeInEditor({ page, text: 'Hello' });
    await editor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Add comment' }).click();

    const thread = page.locator('.bn-thread');
    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();
    await expect(thread.getByText('This is a comment').first()).toBeHidden();
    // Check toolbar is closed after adding a comment
    await expect(page.getByRole('button', { name: 'Paragraph' })).toBeHidden();

    await editor.first().click();
    await editor.getByText('Hello').click();

    await expect(thread.getByText('This is a comment').first()).toBeVisible();
  });
});

test.describe('Doc Comments Side Panel', () => {
  test('it checks comments side bar interaction', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'comment-doc-panel', browserName, 1);

    await expect(
      page.getByRole('button', { name: 'Show the comments sidebar' }),
    ).toBeHidden();

    // Create comment thread
    const editor = await writeInEditor({ page, text: 'Hello World' });
    await editor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Add comment' }).click();

    const thread = page.locator('.bn-thread');
    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();

    // Open comment side panel and check comment is visible in side panel
    await page
      .getByRole('button', { name: 'Show the comments sidebar' })
      .click();

    const elCommentsSidePanel = page.getByLabel('Comments side panel');
    await expect(
      elCommentsSidePanel.getByText('This is a comment'),
    ).toBeVisible();

    // Click on comment in side panel and check it scrolls to the comment in the doc
    await tryFocusEditorContent({ page });
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Enter');
    }
    await writeInEditor({
      page,
      text: 'New paragraph',
    });

    await expect(editor.getByText('New paragraph')).toBeInViewport();
    await elCommentsSidePanel.getByText('This is a comment').click();

    await expect(editor.getByText('Hello World')).toBeVisible();
    await expect(editor.getByText('New paragraph')).not.toBeInViewport();
    await expect(editor.getByText('Hello World')).toHaveClass(
      'bn-thread-mark-selected',
    );

    // Add a comment in the side panel
    await elCommentsSidePanel
      .locator(
        '.bn-editor[contenteditable="true"] div[data-content-type="paragraph"]',
      )
      .first()
      .fill('This is another comment');
    await elCommentsSidePanel.locator('[data-test="save"]').click();
    await expect(
      elCommentsSidePanel
        .locator(
          '.bn-editor[contenteditable="false"] div[data-content-type="paragraph"]',
        )
        .getByText('This is another comment'),
    ).toBeVisible();

    // Close the side panel and check the comments in the doc
    await page
      .getByRole('button', { name: 'Close the comments sidebar' })
      .click();
    await expect(elCommentsSidePanel).toBeHidden();
    await editor.getByText('Hello World').click();
    await expect(thread.getByText('This is another comment')).toBeVisible();

    // Resolve the comment and check it disappears from the side panel and the doc
    await thread.getByText('This is a comment').first().hover();
    await thread.locator('[data-test="resolve"]').click();
    await expect(thread).toBeHidden();
    await page
      .getByRole('button', { name: 'Show the comments sidebar' })
      .click();
    await expect(
      elCommentsSidePanel.getByText('This is a comment'),
    ).toBeHidden();

    // Goto resolved part, the comment should be visible in the side panel
    await elCommentsSidePanel
      .getByRole('button', { name: 'Filter comments' })
      .click();
    await page.getByRole('menuitem', { name: 'Resolved' }).click();
    await elCommentsSidePanel.getByText('This is a comment').click();
    await expect(editor.getByText('Hello World')).toHaveClass(
      'bn-thread-mark-selected',
    );

    // Unresolve the comment and check it does not appears in the side panel resolved part
    await thread.getByText('This is a comment').first().hover();
    await thread.locator('[data-test="re-open"]').click();
    await expect(
      elCommentsSidePanel.getByText('This is a comment'),
    ).toBeHidden();

    // It should be back in the side panel and in the doc
    await page.getByRole('button', { name: 'Filter comments' }).click();
    await page.getByRole('menuitem', { name: 'Open' }).click();
    await expect(
      elCommentsSidePanel.getByText('This is a comment'),
    ).toBeVisible();
    await elCommentsSidePanel.getByText('This is a comment').click();
    await expect(editor.getByText('Hello World')).toHaveClass(
      'bn-thread-mark-selected',
    );
  });

  test('it checks comments accessibility', async ({ page, browserName }) => {
    await createDoc(page, 'comment-doc-panel', browserName, 1);

    // Create comment thread
    const editor = await writeInEditor({ page, text: 'Hello World' });
    await editor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Add comment' }).click();

    const thread = page.locator('.bn-thread');
    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();

    // Open comment side panel and check aria attributes
    await page
      .getByRole('button', { name: 'Show the comments sidebar' })
      .click();

    const elCommentsSidePanel = page.getByLabel('Comments side panel');
    await expect(elCommentsSidePanel).not.toHaveAttribute('inert');

    // Check panel get the focus when opening
    await page.keyboard.press('Tab');
    await expect(
      elCommentsSidePanel.getByRole('button', { name: 'Filter comments' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');

    // Check the focus goes back to the button that open the side panel
    await expect(
      elCommentsSidePanel.getByRole('button', {
        name: 'Close the comments sidebar',
      }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(elCommentsSidePanel).toBeHidden();
    await expect(
      page.getByRole('complementary', { name: 'Side panel' }),
    ).toHaveAttribute('inert');
    await expect(
      page.getByRole('button', { name: 'Show the comments sidebar' }),
    ).toBeFocused();
  });
});
