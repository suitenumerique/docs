import fs from 'fs';
import path from 'path';

import { Page, TestInfo, expect } from '@playwright/test';
import { PDFParse } from 'pdf-parse';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

import { BrowserName, randomName, writeReport } from './utils-common';
import { openSuggestionMenu } from './utils-editor';

/**
 * The collaboration server's http root, from the websocket url the app is configured
 * with: `ws://host/collaboration/ws/v1/docs` -> `http://host/collaboration`. The org is
 * the last segment of that path and is spelled out again by each route below.
 */
const collaborationApiUrl = () =>
  (process.env.COLLABORATION_WS_URL ?? '')
    .replace(/^ws/, 'http')
    .replace(/\/ws\/v1\/docs\/?$/, '');

/**
 * Give a document a body worth exporting: the fixture in
 * `assets/base-content-test-pdf.txt` holds one block of nearly every kind, which is
 * what makes the export regressions below able to catch anything.
 *
 * The fixture is a Yjs update, and it is pushed to the collaboration server rather
 * than stubbed into a response. It used to be the latter - `GET /documents/{id}/content/`
 * was intercepted and answered with this file - but that endpoint no longer exists, so
 * the interception silently matched nothing and the exported document was whatever the
 * two images below added to an empty page. The server is now the only thing that holds
 * document content, so seeding it there is also the only way to put content in a
 * document without typing it.
 *
 * The seed lands before the editor ever mounts. A `PATCH` merges, and BlockNote writes
 * an empty paragraph into any document it opens empty - seeding a document that has
 * already been opened would leave that stray paragraph in front of the fixture and
 * shift every page of the render.
 * @param page
 */
export const overrideDocContent = async ({
  page,
  browserName,
}: {
  page: Page;
  browserName: BrowserName;
}) => {
  const [randomDoc] = randomName('doc-export-override-content', browserName, 1);

  // created over the api rather than through the interface, which would open it
  const cookies = await page.context().cookies();
  const csrfToken = cookies.find((c) => c.name === 'csrftoken')?.value ?? '';
  const created = await page.request.post(
    `${process.env.BASE_API_URL}/documents/`,
    { data: { title: randomDoc }, headers: { 'X-CSRFToken': csrfToken } },
  );
  expect(created.ok()).toBeTruthy();
  const { id: docId } = (await created.json()) as { id: string };

  // `PATCH /ydoc` takes the update in its `update` field; a json body carries a
  // Uint8Array as base64, which is what the fixture already is
  const seeded = await page.request.patch(
    `${collaborationApiUrl()}/ydoc/v1/docs/${docId}`,
    {
      headers: { Accept: 'application/json' },
      data: {
        update: fs
          .readFileSync(
            path.join(__dirname, 'assets/base-content-test-pdf.txt'),
            'utf-8',
          )
          .trim(),
      },
    },
  );
  expect(seeded.ok()).toBeTruthy();

  await page.goto(`/docs/${docId}/`);

  // the seed has to be on screen before anything is added after it
  await expect(page.getByText('Hello Heading 1')).toBeVisible({
    timeout: 15000,
  });

  await expect(page.getByText('copy/pasting out of doc')).toBeVisible();

  // Add Image SVG
  await openSuggestionMenu({
    page,
    suggestion: 'Resizable image with caption',
  });
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Upload image').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(__dirname, 'assets/test.svg'));
  const image = page
    .locator('.--docs--editor-container img.bn-visual-media[src$=".svg"]')
    .first();
  await expect(image).toBeVisible({
    timeout: 10000,
  });
  await page.keyboard.press('Enter');

  await page.waitForTimeout(1000);

  // Add Image PNG
  await openSuggestionMenu({
    page,
    suggestion: 'Resizable image with caption',
  });
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
      expect(diffRatio).toBeLessThan(maxDiffRatio);
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
