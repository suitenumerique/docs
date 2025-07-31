import { expect, test } from '@playwright/test';

test.describe('Doc Editor - Heading Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should filter heading options progressively (h1 -> h2 -> h3)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Nouveau doc' }).click();

    await page.waitForURL('**/docs/**', {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });

    const input = page.getByLabel('doc title input');
    await input.fill('heading-accessibility-test');
    await input.blur();

    const editor = page.locator('.ProseMirror');
    await editor.click();

    await page.keyboard.type('/');
    await expect(page.getByText('Titre 1')).toBeVisible();
    await expect(page.getByText('Titre 2')).toBeHidden();
    await expect(page.getByText('Titre 3')).toBeHidden();

    await page.getByText('Titre 1').click();
    await page.keyboard.type('Main Title');
    await page.keyboard.press('Enter');

    await editor.click();
    await page.keyboard.type('/');

    await expect(page.getByText('Titre 1')).toBeHidden();
    await expect(page.getByText('Titre 2')).toBeVisible();
    await expect(page.getByText('Titre 3')).toBeHidden();

    await page.getByText('Titre 2').click();
    await page.keyboard.type('Sub Title');
    await page.keyboard.press('Enter');

    await editor.click();
    await page.keyboard.type('/');

    await expect(page.getByText('Titre 1')).toBeHidden();
    await expect(page.getByText('Titre 2')).toBeVisible();
    await expect(page.getByText('Titre 3')).toBeVisible();

    await page.getByText('Titre 3').click();
    await page.keyboard.type('Sub Sub Title');
    await page.keyboard.press('Enter');

    await editor.click();
    await page.keyboard.type('/');

    await expect(page.getByText('Titre 1')).toBeHidden();
    await expect(page.getByText('Titre 2')).toBeHidden();
    await expect(page.getByText('Titre 3')).toBeVisible();

    await page.getByText('Titre 3').click();
    await page.keyboard.type('Another Sub Sub Title');
    await page.keyboard.press('Enter');

    await editor.click();
    await page.keyboard.type('/');

    await expect(page.getByText('Titre 1')).toBeHidden();
    await expect(page.getByText('Titre 2')).toBeHidden();
    await expect(page.getByText('Titre 3')).toBeVisible();
  });
});
