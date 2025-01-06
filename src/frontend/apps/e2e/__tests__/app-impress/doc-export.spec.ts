import { expect, test } from '@playwright/test';
import cs from 'convert-stream';
import pdf from 'pdf-parse';

import { createDoc, verifyDocName } from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Export', () => {
  test('it check if all elements are visible', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'doc-editor', browserName, 1);
    await page
      .getByRole('button', {
        name: 'download',
      })
      .click();

    await expect(
      page
        .locator('div')
        .filter({ hasText: /^Download$/ })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Upload your docs to a Microsoft Word, Open Office or PDF document',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Template' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Format' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Close the modal' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
  });
  test('it converts the doc to pdf with a template integrated', async ({
    page,
    browserName,
  }) => {
    const [randomDoc] = await createDoc(page, 'doc-editor', browserName, 1);

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.pdf`);
    });

    await verifyDocName(page, randomDoc);

    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').fill('Hello World');

    await page
      .getByRole('button', {
        name: 'download',
      })
      .click();

    await page
      .getByRole('button', {
        name: 'Download',
      })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfText = (await pdf(pdfBuffer)).text;

    expect(pdfText).toContain('Hello World'); // This is the doc text
  });

  test('it converts the doc to docx with a template integrated', async ({
    page,
    browserName,
  }) => {
    const [randomDoc] = await createDoc(page, 'doc-editor', browserName, 1);

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.docx`);
    });

    await verifyDocName(page, randomDoc);

    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').fill('Hello World');

    await page
      .getByRole('button', {
        name: 'download',
      })
      .click();

    await page.getByRole('combobox', { name: 'Format' }).click();
    await page.getByRole('option', { name: 'Word / Open Office' }).click();

    await page
      .getByRole('button', {
        name: 'Download',
      })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.docx`);
  });
});
