import fs from 'fs';
import path from 'path';

import { Page, TestInfo, expect } from '@playwright/test';
import { PDFParse } from 'pdf-parse';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

import {
  BrowserName,
  createDoc,
  verifyDocName,
  writeReport,
} from './utils-common';
import { openSuggestionMenu } from './utils-editor';

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

export const savePDFToAssetFolder = async (
  pdfBuffer: Buffer,
  filename: string,
) => {
  const pdfPath = path.join(__dirname, 'assets', filename);
  fs.writeFileSync(pdfPath, pdfBuffer);
};

interface ComparePDFWithAssetFolderOptions {
  originPdfBuffer: Buffer;
  filename: string;
  compareTextContent?: boolean;
  comparePixel?: boolean;
  testInfo?: TestInfo;
}
export const comparePDFWithAssetFolder = async ({
  originPdfBuffer,
  filename,
  compareTextContent = true,
  comparePixel = true,
  testInfo,
}: ComparePDFWithAssetFolderOptions) => {
  // Load reference PDF for comparison
  const referencePdfPath = path.join(__dirname, 'assets', filename);
  const referencePdfBuffer = fs.readFileSync(referencePdfPath);

  // Parse both PDFs
  const generatedPdf = new PDFParse({ data: originPdfBuffer });
  const referencePdf = new PDFParse({ data: referencePdfBuffer });

  const [generatedInfo, referenceInfo] = await Promise.all([
    generatedPdf.getInfo(),
    referencePdf.getInfo(),
  ]);

  const [generatedScreenshot, referenceScreenshot] = await Promise.all([
    generatedPdf.getScreenshot(),
    referencePdf.getScreenshot(),
  ]);

  const [generatedText, referenceText] = await Promise.all([
    generatedPdf.getText(),
    referencePdf.getText(),
  ]);

  // Compare page count
  expect(generatedInfo.total).toBe(referenceInfo.total);

  /* 
    Compare text content
    We make this optional because text extraction from PDFs can vary
    slightly between environments and PDF versions, leading to false negatives.
    Particularly with emojis which can be represented differently when 
    exporting or parsing the PDF.
  */
  if (compareTextContent) {
    expect(generatedText.text).toBe(referenceText.text);
  }

  // Compare screenshots page by page
  for (let i = 0; i < generatedScreenshot.pages.length; i++) {
    const genPage = generatedScreenshot.pages[i];
    const refPage = referenceScreenshot.pages[i];

    const genPng = PNG.sync.read(Buffer.from(genPage.data));
    const refPng = PNG.sync.read(Buffer.from(refPage.data));

    // Compare actual raster dimensions (integers)
    expect(genPng.width).toBe(refPng.width);
    expect(genPng.height).toBe(refPng.height);

    if (!comparePixel) {
      continue;
    }

    const diffPng = new PNG({ width: genPng.width, height: genPng.height });

    const numDiffPixels = pixelmatch(
      genPng.data,
      refPng.data,
      diffPng.data,
      genPng.width,
      genPng.height,
      { threshold: 0.1, includeAA: false },
    );

    const totalPixels = genPng.width * genPng.height;
    const diffRatio = numDiffPixels / totalPixels;
    const maxDiffRatio = 0.0005;

    try {
      expect(numDiffPixels).toBeLessThan(0.0005);
    } catch {
      if (testInfo) {
        const pageNo = String(i + 1).padStart(2, '0');

        await writeReport(
          testInfo,
          `generated.pdf`,
          `pdf-generated`,
          originPdfBuffer,
          'application/pdf',
        );
        await writeReport(
          testInfo,
          `reference.pdf`,
          `pdf-reference`,
          referencePdfBuffer,
          'application/pdf',
        );
        await writeReport(
          testInfo,
          `page-${pageNo}-diff.png`,
          `page-${pageNo}-diff`,
          PNG.sync.write(diffPng),
          'image/png',
        );
        await writeReport(
          testInfo,
          `page-${pageNo}-generated.png`,
          `page-${pageNo}-generated`,
          PNG.sync.write(genPng),
          'image/png',
        );
        await writeReport(
          testInfo,
          `page-${pageNo}-reference.png`,
          `page-${pageNo}-reference`,
          PNG.sync.write(refPng),
          'image/png',
        );
      }

      throw new Error(
        `PDF visual regression: ${filename} page ${i + 1} diffRatio=${diffRatio.toFixed(6)} (${numDiffPixels} px) > ${maxDiffRatio}`,
      );
    }
  }
};
