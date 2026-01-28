import { readFileSync } from 'fs';
import path from 'path';

import { Page, expect, test } from '@playwright/test';

import { getEditor } from './utils-editor';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Import', () => {
  test('it imports 2 docs with the import icon', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByLabel('Open the upload dialog').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      path.join(__dirname, 'assets/test_import.docx'),
      path.join(__dirname, 'assets/test_import.md'),
    ]);

    await expect(
      page.getByText(
        'The document "test_import.docx" has been successfully imported',
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'The document "test_import.md" has been successfully imported',
      ),
    ).toBeVisible();

    const docsGrid = page.getByTestId('docs-grid');
    await expect(docsGrid.getByText('test_import.docx').first()).toBeVisible();
    await expect(docsGrid.getByText('test_import.md').first()).toBeVisible();

    // Check content of imported md
    await docsGrid.getByText('test_import.md').first().click();
    const editor = await getEditor({ page });

    const contentCheck = async (isMDCheck = false) => {
      await expect(
        editor.getByRole('heading', {
          name: 'Lorem Ipsum import Document',
          level: 1,
        }),
      ).toBeVisible();
      await expect(
        editor.getByRole('heading', {
          name: 'Introduction',
          level: 2,
        }),
      ).toBeVisible();
      await expect(
        editor.getByRole('heading', {
          name: 'Subsection 1.1',
          level: 3,
        }),
      ).toBeVisible();
      await expect(
        editor
          .locator('div[data-content-type="bulletListItem"] strong')
          .getByText('Bold text'),
      ).toBeVisible();
      await expect(
        editor
          .locator('div[data-content-type="codeBlock"]')
          .getByText('hello_world'),
      ).toBeVisible();
      await expect(
        editor
          .locator('div[data-content-type="table"] td')
          .getByText('Paragraph'),
      ).toBeVisible();
      await expect(
        editor.locator('a[href="http://localhost:3000/"]').getByText('Example'),
      ).toBeVisible();

      /* eslint-disable playwright/no-conditional-expect */
      if (isMDCheck) {
        await expect(
          editor.locator(
            'img[src="http://localhost:3000/assets/logo-suite-numerique.png"]',
          ),
        ).toBeVisible();
        await expect(
          editor.locator(
            'img[src="http://localhost:3000/assets/icon-docs.svg"]',
          ),
        ).toBeVisible();
      } else {
        await expect(editor.locator('img')).toHaveCount(2);
      }
      /* eslint-enable playwright/no-conditional-expect */

      /**
       * Divider are not supported in docx import in DocSpec 2.4.4
       */
      /* eslint-disable playwright/no-conditional-expect */
      if (isMDCheck) {
        await expect(
          editor.locator('div[data-content-type="divider"] hr'),
        ).toBeVisible();
      }
      /* eslint-enable playwright/no-conditional-expect */
    };

    await contentCheck(true);

    // Check content of imported docx
    await page.getByLabel('Back to homepage').first().click();
    await docsGrid.getByText('test_import.docx').first().click();

    await contentCheck();
  });

  test('it imports 2 docs with the drag and drop area', async ({ page }) => {
    const docsGrid = page.getByTestId('docs-grid');
    await expect(docsGrid).toBeVisible();

    await dragAndDropFiles(page, "[data-testid='docs-grid']", [
      {
        filePath: path.join(__dirname, 'assets/test_import.docx'),
        fileName: 'test_import.docx',
        fileType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      {
        filePath: path.join(__dirname, 'assets/test_import.md'),
        fileName: 'test_import.md',
        fileType: 'text/markdown',
      },
    ]);

    // Wait for success messages
    await expect(
      page.getByText(
        'The document "test_import.docx" has been successfully imported',
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'The document "test_import.md" has been successfully imported',
      ),
    ).toBeVisible();

    await expect(docsGrid.getByText('test_import.docx').first()).toBeVisible();
    await expect(docsGrid.getByText('test_import.md').first()).toBeVisible();
  });
});

const dragAndDropFiles = async (
  page: Page,
  selector: string,
  files: Array<{ filePath: string; fileName: string; fileType?: string }>,
) => {
  const filesData = files.map((file) => ({
    bufferData: `data:application/octet-stream;base64,${readFileSync(file.filePath).toString('base64')}`,
    fileName: file.fileName,
    fileType: file.fileType || '',
  }));

  const dataTransfer = await page.evaluateHandle(async (filesInfo) => {
    const dt = new DataTransfer();

    for (const fileInfo of filesInfo) {
      const blobData = await fetch(fileInfo.bufferData).then((res) =>
        res.blob(),
      );
      const file = new File([blobData], fileInfo.fileName, {
        type: fileInfo.fileType,
      });
      dt.items.add(file);
    }

    return dt;
  }, filesData);

  await page.dispatchEvent(selector, 'drop', { dataTransfer });
};
