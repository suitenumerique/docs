import { Page, expect, test } from '@playwright/test';

import { createDoc, overrideConfig } from './utils-common';
import { getEditor } from './utils-editor';

const dropFileInEditor = async (page: Page) => {
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    // 1MB + 1 byte, exceeds the 1MB limit set in overrideConfig.
    const file = new File([new Uint8Array(1048577)], 'video.mp4', {
      type: 'video/mp4',
    });
    dt.items.add(file);
    return dt;
  });

  await page
    .getByLabel('Document editor')
    .dispatchEvent('drop', { dataTransfer });
};

const pasteFileInEditor = async (page: Page) => {
  await page.getByLabel('Document editor').focus();

  await page.getByLabel('Document editor').evaluate((el) => {
    const dt = new DataTransfer();
    const file = new File([new Uint8Array(1048577)], 'video.mp4', {
      type: 'video/mp4',
    });
    dt.items.add(file);

    const event = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
  });
};

test.describe('Doc Editor - File Upload', () => {
  test('dropping a file that is too large shows an error and does not leave a loading block', async ({
    page,
    browserName,
  }) => {
    await overrideConfig(page, { DOCUMENT_IMAGE_MAX_SIZE: 1048576 }); // Override the size limit to 1MB for the test.
    await page.goto('/');
    await createDoc(page, 'doc-upload-too-large', browserName, 1);
    await getEditor({ page });

    await dropFileInEditor(page);

    await expect(
      page.getByText('File size exceeds the maximum allowed size of 1MB.'),
    ).toBeVisible();

    await expect(page.getByText('Loading...')).toBeHidden();
  });

  test('dismissing the error and dropping the same file again shows the error again', async ({
    page,
    browserName,
  }) => {
    await overrideConfig(page, { DOCUMENT_IMAGE_MAX_SIZE: 1048576 }); // Override the size limit to 1MB for the test.
    await page.goto('/');
    await createDoc(page, 'doc-upload-error-retry', browserName, 1);
    await getEditor({ page });

    await dropFileInEditor(page);
    await expect(
      page.getByText('File size exceeds the maximum allowed size of 1MB.'),
    ).toBeVisible();

    // Dismiss the error
    await page.locator('.--docs--text-errors').getByRole('button').click();
    await expect(
      page.getByText('File size exceeds the maximum allowed size of 1MB.'),
    ).toBeHidden();

    // Drop the same file again
    await dropFileInEditor(page);
    await expect(
      page.getByText('File size exceeds the maximum allowed size of 1MB.'),
    ).toBeVisible();
  });

  test('pasting a file that is too large shows an error and does not leave a loading block', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === 'firefox',
      'Firefox does not expose clipboardData.items on synthetic ClipboardEvents, making this untestable via dispatchEvent.',
    );
    await overrideConfig(page, { DOCUMENT_IMAGE_MAX_SIZE: 1048576 });
    await page.goto('/');
    await createDoc(page, 'doc-upload-paste-too-large', browserName, 1);
    await getEditor({ page });

    await pasteFileInEditor(page);

    await expect(
      page.getByText('File size exceeds the maximum allowed size of 1MB.'),
    ).toBeVisible();

    await expect(page.getByText('Loading...')).toBeHidden();
  });
});
