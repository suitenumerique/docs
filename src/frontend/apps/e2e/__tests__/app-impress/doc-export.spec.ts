import path from 'path';

import { expect, test } from '@playwright/test';
import cs from 'convert-stream';
import { pdf } from 'pdf-parse';

import {
  TestLanguage,
  createDoc,
  randomName,
  verifyDocName,
  waitForLanguageSwitch,
} from './utils-common';
import { openSuggestionMenu, writeInEditor } from './utils-editor';
import { createRootSubPage } from './utils-sub-pages';

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
        name: 'Export the document',
      })
      .click();

    await expect(page.getByTestId('modal-export-title')).toBeVisible();
    await expect(
      page.getByText('Download your document in a .docx, .odt or .pdf format.'),
    ).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Template' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Format' })).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Close the download modal',
      }),
    ).toBeVisible();
    await expect(page.getByTestId('doc-export-download-button')).toBeVisible();
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

    const editor = await writeInEditor({ page, text: 'Hello' });
    await page.keyboard.press('Enter');
    await openSuggestionMenu({ page });
    await page.getByText('Page Break').click();

    await expect(
      editor.locator('div[data-content-type="pageBreak"]'),
    ).toBeVisible();

    await writeInEditor({ page, text: 'World' });

    await page
      .getByRole('button', {
        name: 'Export the document',
      })
      .click();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.pdf`);
    });

    void page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfData = await pdf(pdfBuffer);

    expect(pdfData.total).toBe(2);
    expect(pdfData.text).toContain('Hello\n\nWorld\n\n'); // This is the doc text
    expect(pdfData.info?.Title).toBe(randomDoc);
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

    const image = page
      .locator('.--docs--editor-container img.bn-visual-media')
      .first();

    await expect(image).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Export the document',
      })
      .click();

    await page.getByRole('combobox', { name: 'Format' }).click();
    await page.getByRole('option', { name: 'Docx' }).click();

    await expect(page.getByTestId('doc-export-download-button')).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.docx`);
    });

    void page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.docx`);
  });

  test('it exports the doc to odt', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-editor-odt', browserName, 1);

    await verifyDocName(page, randomDoc);

    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').fill('Hello World ODT');

    await page.keyboard.press('Enter');
    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Resizable image with caption').click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Upload image').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'assets/test.svg'));

    const image = page
      .locator('.--docs--editor-container img.bn-visual-media')
      .first();

    await expect(image).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Export the document',
      })
      .click();

    await page.getByRole('combobox', { name: 'Format' }).click();
    await page.getByRole('option', { name: 'Odt' }).click();

    await expect(page.getByTestId('doc-export-download-button')).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.odt`);
    });

    void page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.odt`);
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

    await writeInEditor({
      page,
      text: 'Hello World 😃🎉🚀🙋‍♀️🧑🏿‍❤️‍💋‍🧑🏾',
    });

    await page.keyboard.press('Enter');
    await openSuggestionMenu({ page });
    await page.getByText('Resizable image with caption').click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Upload image').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'assets/test.svg'));

    const image = page
      .locator('.--docs--editor-container img.bn-visual-media')
      .first();

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
        name: 'Export the document',
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

    await expect(page.getByTestId('doc-export-download-button')).toBeVisible();

    const responseCorsPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/cors-proxy/') && response.status() === 200,
    );

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.pdf`);
    });

    void page.getByTestId('doc-export-download-button').click();

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
        name: 'Export the document',
      })
      .click();

    await expect(page.getByTestId('doc-export-download-button')).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.pdf`);
    });

    void page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfData = await pdf(pdfBuffer);

    expect(pdfData.text).toContain('Hello World'); // This is the pdf text
  });

  test('it exports the doc with multi columns', async ({
    page,
    browserName,
  }) => {
    const [randomDoc] = await createDoc(
      page,
      'doc-multi-columns',
      browserName,
      1,
    );

    await page.locator('.bn-block-outer').last().fill('/');

    await page.getByText('Three Columns', { exact: true }).click();

    await page.locator('.bn-block-column').first().fill('Column 1');
    await page.locator('.bn-block-column').nth(1).fill('Column 2');
    await page.locator('.bn-block-column').last().fill('Column 3');

    expect(await page.locator('.bn-block-column').count()).toBe(3);
    await expect(
      page.locator('.bn-block-column[data-node-type="column"]').first(),
    ).toHaveText('Column 1');
    await expect(
      page.locator('.bn-block-column[data-node-type="column"]').nth(1),
    ).toHaveText('Column 2');
    await expect(
      page.locator('.bn-block-column[data-node-type="column"]').last(),
    ).toHaveText('Column 3');

    await page
      .getByRole('button', {
        name: 'Export the document',
      })
      .click();

    await expect(
      page.getByTestId('doc-open-modal-download-button'),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.pdf`);
    });

    void page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfData = await pdf(pdfBuffer);
    expect(pdfData.text).toContain('Column 1');
    expect(pdfData.text).toContain('Column 2');
    expect(pdfData.text).toContain('Column 3');
  });

  test('it injects the correct language attribute into PDF export', async ({
    page,
    browserName,
  }) => {
    await waitForLanguageSwitch(page, TestLanguage.French);

    // Wait for the page to be ready after language switch
    await page.waitForLoadState('domcontentloaded');

    const header = page.locator('header').first();
    await header.locator('h1').getByText('Docs').click();

    const randomDocFrench = randomName(
      'doc-language-export-french',
      browserName,
      1,
    )[0];

    await page
      .getByRole('button', {
        name: 'Nouveau doc',
      })
      .click();

    const input = page.getByRole('textbox', { name: 'Titre du document' });
    await expect(input).toBeVisible();
    await expect(input).toHaveText('', { timeout: 10000 });
    await input.click();
    await input.fill(randomDocFrench);
    await input.blur();

    const editor = page.locator('.ProseMirror.bn-editor');
    await editor.click();
    await editor.fill('Contenu de test pour export en français');

    await page
      .getByRole('button', {
        name: 'Exporter le document',
      })
      .click();

    await expect(
      page.getByTestId('doc-open-modal-download-button'),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDocFrench}.pdf`);
    });

    void page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDocFrench}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfString = pdfBuffer.toString('latin1');

    expect(pdfString).toContain('/Lang (fr)');
  });

  test('it exports the doc with interlinking', async ({
    page,
    browserName,
  }) => {
    const [randomDoc] = await createDoc(
      page,
      'export-interlinking',
      browserName,
      1,
    );

    await verifyDocName(page, randomDoc);

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'export-interlink-child',
    );

    await verifyDocName(page, docChild);

    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Link a doc').first().click();

    const input = page.locator(
      "span[data-inline-content-type='interlinkingSearchInline'] input",
    );
    const searchContainer = page.locator('.quick-search-container');

    await input.fill('export-interlink');

    await expect(searchContainer).toBeVisible();
    await expect(searchContainer.getByText(randomDoc)).toBeVisible();

    // We are in docChild, we want to create a link to randomDoc (parent)
    await searchContainer.getByText(randomDoc).click();

    // Search the interlinking link in the editor (not in the document tree)
    const editor = page.locator('.ProseMirror.bn-editor');
    const interlink = editor.getByRole('button', {
      name: randomDoc,
    });

    await expect(interlink).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${docChild}.pdf`);
    });

    await page
      .getByRole('button', {
        name: 'Export the document',
      })
      .click();

    void page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${docChild}.pdf`);

    const pdfBuffer = await cs.toBuffer(await download.createReadStream());
    const pdfData = await pdf(pdfBuffer);

    expect(pdfData.text).toContain(randomDoc);
  });

  test('it exports the doc with interlinking to odt', async ({
    page,
    browserName,
  }) => {
    const [randomDoc] = await createDoc(
      page,
      'export-interlinking-odt',
      browserName,
      1,
    );

    await verifyDocName(page, randomDoc);

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'export-interlink-child-odt',
    );

    await verifyDocName(page, docChild);

    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Link a doc').first().click();

    const input = page.locator(
      "span[data-inline-content-type='interlinkingSearchInline'] input",
    );
    const searchContainer = page.locator('.quick-search-container');

    await input.fill('export-interlink');

    await expect(searchContainer).toBeVisible();
    await expect(searchContainer.getByText(randomDoc)).toBeVisible();

    // We are in docChild, we want to create a link to randomDoc (parent)
    await searchContainer.getByText(randomDoc).click();

    // Search the interlinking link in the editor (not in the document tree)
    const editor = page.locator('.ProseMirror.bn-editor');
    const interlink = editor.getByRole('button', {
      name: randomDoc,
    });

    await expect(interlink).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Export the document',
      })
      .click();

    await page.getByRole('combobox', { name: 'Format' }).click();
    await page.getByRole('option', { name: 'Odt' }).click();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${docChild}.odt`);
    });

    void page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${docChild}.odt`);
  });
});
