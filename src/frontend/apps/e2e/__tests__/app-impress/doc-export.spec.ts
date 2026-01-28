import fs from 'fs';
import path from 'path';

import { Download, Page, expect, test } from '@playwright/test';
import cs from 'convert-stream';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

import {
  BrowserName,
  TestLanguage,
  createDoc,
  verifyDocName,
  waitForLanguageSwitch,
} from './utils-common';
import { openSuggestionMenu, writeInEditor } from './utils-editor';

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
      page.getByText(/Download your document in a \.docx, \.odt.*format\./i),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Format' })).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Close the download modal',
      }),
    ).toBeVisible();
    await expect(page.getByTestId('doc-export-download-button')).toBeVisible();
  });

  /**
   * We override the document content to ensure that the exported DOCX
   * contains various elements for testing.
   * We don't check the content of the DOCX here, just that the export works
   * and the file is correctly named.
   */
  test('it exports the doc to docx', async ({ page, browserName }) => {
    const randomDoc = await overrideDocContent({ page, browserName });

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

  /**
   * We override the document content to ensure that the exported ODT
   * contains various elements for testing.
   * We don't check the content of the ODT here, just that the export works
   * and the file is correctly named.
   */
  test('it exports the doc to odt', async ({ page, browserName }) => {
    const randomDoc = await overrideDocContent({ page, browserName });

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

  test('it exports the doc to html zip', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(
      page,
      'doc-editor-html-zip',
      browserName,
      1,
    );

    await verifyDocName(page, randomDoc);

    // Add some content and at least one image so that the ZIP contains media files.
    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').fill('Hello HTML ZIP');

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

    // Wait for the image to be attached and have a valid src (aria-hidden prevents toBeVisible on Chromium)
    await expect(image).toBeAttached({ timeout: 10000 });
    await expect(image).toHaveAttribute('src', /.*\.svg/);

    // Give some time for the image to be fully processed
    await page.waitForTimeout(1000);

    await page
      .getByRole('button', {
        name: 'Export the document',
      })
      .click();

    await page.getByRole('combobox', { name: 'Format' }).click();
    await page.getByRole('option', { name: 'HTML' }).click();

    await expect(page.getByTestId('doc-export-download-button')).toBeVisible();

    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`${randomDoc}.zip`);
    });

    void page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.zip`);

    const zipBuffer = await cs.toBuffer(await download.createReadStream());
    // Unzip and inspect contents
    const zip = await JSZip.loadAsync(zipBuffer);

    // Check that index.html exists
    const indexHtml = zip.file('index.html');
    expect(indexHtml).not.toBeNull();

    // Read and verify HTML content
    const htmlContent = await indexHtml!.async('string');
    expect(htmlContent).toContain('Hello HTML ZIP');
    expect(htmlContent).toContain('href="styles.css"');

    // Check for media files (they are at the root of the ZIP, not in a media/ folder)
    // Media files are named like "1-test.svg" or "media-1.png" by deriveMediaFilename
    const allFiles = Object.keys(zip.files);
    const mediaFiles = allFiles.filter(
      (name) => name !== 'index.html' && !name.endsWith('/'),
    );
    expect(mediaFiles.length).toBeGreaterThan(0);

    // Verify the SVG image is included
    const svgFile = mediaFiles.find((name) => name.endsWith('.svg'));
    expect(svgFile).toBeDefined();
    const styleFile = mediaFiles.find((name) => name === 'styles.css');
    expect(styleFile).toBeDefined();
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

    const pdfParse = new PDFParse({ data: pdfBuffer });
    const pdfText = await pdfParse.getText();
    expect(pdfText.text).toContain('Hello World');
  });

  test('it injects the correct language attribute into PDF export', async ({
    page,
    browserName,
  }) => {
    const [randomDocFrench] = await createDoc(
      page,
      'doc-language-export-french',
      browserName,
      1,
    );

    await waitForLanguageSwitch(page, TestLanguage.French);

    // Wait for the page to be ready after language switch
    await page.waitForLoadState('domcontentloaded');

    await writeInEditor({
      page,
      text: 'Contenu de test pour export en français',
    });

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

  test('it exports the doc to PDF and checks regressions', async ({
    page,
    browserName,
  }) => {
    // PDF Binary comparison is different depending on the browser used
    // We only run this test on Chromium to avoid having to maintain
    // multiple sets of PDF fixtures
    if (browserName !== 'chromium') {
      test.skip();
    }

    const randomDoc = await overrideDocContent({ page, browserName });

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

    await page.getByTestId('doc-export-download-button').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${randomDoc}.pdf`);

    // If we need to update the PDF regression fixture, uncomment the line below
    //await savePDFToAssetFolder(download);

    // Assert the generated PDF matches "assets/doc-export-regressions.pdf"
    await comparePDFWithAssetFolder(download);
  });
});

export const savePDFToAssetFolder = async (download: Download) => {
  const pdfBuffer = await cs.toBuffer(await download.createReadStream());
  const pdfPath = path.join(__dirname, 'assets', `doc-export-regressions.pdf`);
  fs.writeFileSync(pdfPath, pdfBuffer);
};

export const comparePDFWithAssetFolder = async (download: Download) => {
  const pdfBuffer = await cs.toBuffer(await download.createReadStream());

  // Load reference PDF for comparison
  const referencePdfPath = path.join(
    __dirname,
    'assets',
    'doc-export-regressions.pdf',
  );

  const referencePdfBuffer = fs.readFileSync(referencePdfPath);

  // Parse both PDFs
  const generatedPdf = new PDFParse({ data: pdfBuffer });
  const referencePdf = new PDFParse({ data: referencePdfBuffer });

  const [generatedInfo, referenceInfo] = await Promise.all([
    generatedPdf.getInfo(),
    referencePdf.getInfo(),
  ]);

  const [generatedScreenshot, referenceScreenshot] = await Promise.all([
    generatedPdf.getScreenshot(),
    referencePdf.getScreenshot(),
  ]);
  generatedScreenshot.pages[0].data;

  const [generatedText, referenceText] = await Promise.all([
    generatedPdf.getText(),
    referencePdf.getText(),
  ]);

  // Compare page count
  expect(generatedInfo.total).toBe(referenceInfo.total);

  // Compare text content
  expect(generatedText.text).toBe(referenceText.text);

  // Compare screenshots page by page
  for (let i = 0; i < generatedScreenshot.pages.length; i++) {
    const genPage = generatedScreenshot.pages[i];
    const refPage = referenceScreenshot.pages[i];

    expect(genPage.width).toBe(refPage.width);
    expect(genPage.height).toBe(refPage.height);
    try {
      expect(genPage.data).toStrictEqual(refPage.data);
    } catch {
      throw new Error(`PDF page ${i + 1} screenshot does not match reference.`);
    }
  }
};

/**
 * Override the document content API response to use a test content
 * This test content contains many blocks to facilitate testing
 * @param page
 */
export const overrideDocContent = async ({
  page,
  browserName,
}: {
  page: Page;
  browserName: BrowserName;
}) => {
  // Override content prop with assets/base-content-test-pdf.txt
  await page.route(/\**\/documents\/\**/, async (route) => {
    const request = route.request();
    if (
      request.method().includes('GET') &&
      !request.url().includes('page=') &&
      !request.url().includes('versions') &&
      !request.url().includes('accesses') &&
      !request.url().includes('invitations')
    ) {
      const response = await route.fetch();
      const json = await response.json();
      json.content = fs.readFileSync(
        path.join(__dirname, 'assets/base-content-test-pdf.txt'),
        'utf-8',
      );
      void route.fulfill({
        response,
        body: JSON.stringify(json),
      });
    } else {
      await route.continue();
    }
  });

  const [randomDoc] = await createDoc(
    page,
    'doc-export-override-content',
    browserName,
    1,
  );

  await verifyDocName(page, randomDoc);

  await page.waitForTimeout(1000);

  // Add Image SVG
  await page.keyboard.press('Enter');
  const { suggestionMenu } = await openSuggestionMenu({ page });
  await suggestionMenu.getByText('Resizable image with caption').click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Upload image').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(__dirname, 'assets/test.svg'));
  const image = page
    .locator('.--docs--editor-container img.bn-visual-media[src$=".svg"]')
    .first();
  await expect(image).toBeVisible();
  await page.keyboard.press('Enter');

  await page.waitForTimeout(1000);

  // Add Image PNG
  await openSuggestionMenu({ page });
  await suggestionMenu.getByText('Resizable image with caption').click();
  const fileChooserPNGPromise = page.waitForEvent('filechooser');
  await page.getByText('Upload image').click();
  const fileChooserPNG = await fileChooserPNGPromise;
  await fileChooserPNG.setFiles(
    path.join(__dirname, 'assets/logo-suite-numerique.png'),
  );
  const imagePng = page
    .locator('.--docs--editor-container img.bn-visual-media[src$=".png"]')
    .first();
  await expect(imagePng).toBeVisible();

  await page.waitForTimeout(1000);

  return randomDoc;
};
