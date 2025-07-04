import path from 'path';

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
      page.getByText('Download your document in a .docx or .pdf format.'),
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

  test('it exports the doc with pdf line break', async ({
    page,
    browserName,
  }) => {
    const [randomDoc] = await createDoc(
      page,
      'doc-editor-line-break',
      browserName,
      1,
    );

    await verifyDocName(page, randomDoc);

    const editor = page.locator('.ProseMirror.bn-editor');

    await editor.click();
    await editor.locator('.bn-block-outer').last().fill('Hello');

    await page.keyboard.press('Enter');
    await editor.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Page Break').click();

    await expect(editor.locator('.bn-page-break')).toBeVisible();

    await page.keyboard.press('Enter');

    await editor.locator('.bn-block-outer').last().fill('World');

    await page
      .getByRole('button', {
        name: 'download',
        exact: true,
      })
      .click();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.pdf`);
    });

    void page
      .getByRole('button', {
        name: 'Download',
        exact: true,
      })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfData = await pdf(pdfBuffer);

    expect(pdfData.numpages).toBe(2);
    expect(pdfData.text).toContain('\n\nHello\n\nWorld'); // This is the doc text
  });

  test('it exports the doc to docx', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-editor', browserName, 1);

    await verifyDocName(page, randomDoc);

    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').fill('Hello World');

    await page.keyboard.press('Enter');
    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Resizable image with caption').click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Upload image').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'assets/test.svg'));

    const image = page.getByRole('img', { name: 'test.svg' });

    await expect(image).toBeVisible();

    await page
      .getByRole('button', {
        name: 'download',
        exact: true,
      })
      .click();

    await page.getByRole('combobox', { name: 'Format' }).click();
    await page.getByRole('option', { name: 'Docx' }).click();

    await expect(
      page.getByRole('button', {
        name: 'Download',
        exact: true,
      }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.docx`);
    });

    void page
      .getByRole('button', {
        name: 'Download',
        exact: true,
      })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.docx`);
  });

  /**
   * This test tell us that the export to pdf is working with images
   * but it does not tell us if the images are being displayed correctly
   * in the pdf.
   *
   * TODO:  Check if the images are displayed correctly in the pdf
   */
  test('it exports the docs with images', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-editor', browserName, 1);

    await verifyDocName(page, randomDoc);

    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').fill('Hello World');

    await page.keyboard.press('Enter');
    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Resizable image with caption').click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Upload image').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'assets/test.svg'));

    const image = page.getByRole('img', { name: 'test.svg' });

    await expect(image).toBeVisible();

    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Resizable image with caption').click();
    await page.getByRole('tab', { name: 'Embed' }).click();
    await page
      .getByRole('textbox', { name: 'Enter URL' })
      .fill('https://docs.numerique.gouv.fr/assets/logo-gouv.png');
    await page.getByText('Embed image').click();

    await page
      .getByRole('button', {
        name: 'download',
      })
      .click();

    await page
      .getByRole('combobox', {
        name: 'Template',
      })
      .click();

    await page
      .getByRole('option', {
        name: 'Demo Template',
      })
      .click({
        delay: 100,
      });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await expect(
      page.getByRole('button', {
        name: 'Download',
      }),
    ).toBeVisible();

    const responseCorsPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/cors-proxy/') && response.status() === 200,
    );

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.pdf`);
    });

    void page
      .getByRole('button', {
        name: 'Download',
      })
      .click();

    const responseCors = await responseCorsPromise;
    expect(responseCors.ok()).toBe(true);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfExport = await pdf(pdfBuffer);
    const pdfText = pdfExport.text;

    expect(pdfText).toContain('Hello World');
  });

  test('it exports the doc with quotes', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'export-quotes', browserName, 1);

    const editor = page.locator('.ProseMirror.bn-editor');
    // Trigger slash menu to show menu
    await editor.click();
    await editor.fill('/');
    await page.getByText('Quote or excerpt').click();

    await expect(
      editor.locator('.bn-block-content[data-content-type="quote"]'),
    ).toBeVisible();

    await editor
      .locator('.bn-block-content[data-content-type="quote"]')
      .fill('Hello World');

    await expect(editor.getByText('Hello World')).toHaveCSS(
      'font-style',
      'italic',
    );

    await page
      .getByRole('button', {
        name: 'download',
      })
      .click();

    await expect(
      page.getByRole('button', {
        name: 'Download',
      }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.pdf`);
    });

    void page
      .getByRole('button', {
        name: 'Download',
      })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfData = await pdf(pdfBuffer);

    expect(pdfData.text).toContain('Hello World'); // This is the pdf text
  });

  /**
   * We cannot assert the line break is visible in the pdf, but we can assert the
   * line break is visible in the editor and that the pdf is generated.
   */
  test('it exports the doc with divider', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'export-divider', browserName, 1);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Hello World');

    // Trigger slash menu to show menu
    await editor.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Add a horizontal line').click();

    await expect(
      editor.locator('.bn-block-content[data-content-type="divider"]'),
    ).toBeVisible();

    await page
      .getByRole('button', {
        name: 'download',
        exact: true,
      })
      .click();

    await expect(
      page.getByRole('button', {
        name: 'Download',
        exact: true,
      }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.pdf`);
    });

    void page
      .getByRole('button', {
        name: 'Download',
        exact: true,
      })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfData = await pdf(pdfBuffer);
    expect(pdfData.text).toContain('Hello World');
  });
});
