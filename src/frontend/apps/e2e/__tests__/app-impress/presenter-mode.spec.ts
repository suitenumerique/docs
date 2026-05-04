import { Page, expect, test } from '@playwright/test';

import { createDoc, goToGridDoc, mockedDocument } from './utils-common';
import { openSuggestionMenu, writeInEditor } from './utils-editor';

const openPresenter = async (page: Page) => {
  await page.getByLabel('Open the document options').click();
  await page.getByRole('menuitem', { name: 'Present' }).click();

  const overlay = page.getByRole('dialog', { name: 'Presenter mode' });
  await expect(overlay).toBeVisible();
  return overlay;
};

const insertDivider = async (page: Page) => {
  const { suggestionMenu } = await openSuggestionMenu({ page });
  await suggestionMenu.getByText('Divider', { exact: true }).click();
};

const writeMultiSlideDoc = async (page: Page) => {
  const editor = await writeInEditor({ page, text: 'Slide one' });
  await editor.press('Enter');
  await insertDivider(page);
  await editor.press('Enter');
  await writeInEditor({ page, text: 'Slide two' });
  await editor.press('Enter');
  await insertDivider(page);
  await editor.press('Enter');
  await writeInEditor({ page, text: 'Slide three' });
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Presenter Mode', () => {
  test('opens the presenter overlay from the doc options menu and closes with Escape', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-open', browserName, 1);
    await writeInEditor({ page, text: 'Hello presenter' });

    const overlay = await openPresenter(page);

    await expect(
      overlay.getByRole('toolbar', { name: 'Presenter controls' }),
    ).toBeVisible();
    await expect(overlay.getByText('Hello presenter')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('renders a single-slide doc with counter 1/1 and disabled nav buttons', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-single', browserName, 1);
    await writeInEditor({ page, text: 'Slide A' });

    const overlay = await openPresenter(page);

    await expect(overlay.getByText('1 / 1')).toBeVisible();
    await expect(
      overlay.getByRole('button', { name: 'Previous slide' }),
    ).toBeDisabled();
    await expect(
      overlay.getByRole('button', { name: 'Next slide' }),
    ).toBeDisabled();
    await expect(overlay.getByText('Slide A')).toBeVisible();

    await overlay.getByRole('button', { name: 'Close presenter' }).click();
    await expect(overlay).toBeHidden();
  });

  test('navigates between slides via the floating bar buttons', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-nav-bar', browserName, 1);
    await writeMultiSlideDoc(page);

    const overlay = await openPresenter(page);

    const prev = overlay.getByRole('button', { name: 'Previous slide' });
    const next = overlay.getByRole('button', { name: 'Next slide' });

    await expect(overlay.getByText('1 / 3')).toBeVisible();
    await expect(overlay.getByText('Slide one')).toBeVisible();
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();

    await next.click();
    await expect(overlay.getByText('2 / 3')).toBeVisible();
    await expect(overlay.getByText('Slide two')).toBeVisible();

    await next.click();
    await expect(overlay.getByText('3 / 3')).toBeVisible();
    await expect(overlay.getByText('Slide three')).toBeVisible();
    await expect(next).toBeDisabled();
    await expect(prev).toBeEnabled();

    await prev.click();
    await expect(overlay.getByText('2 / 3')).toBeVisible();
    await expect(overlay.getByText('Slide two')).toBeVisible();
  });

  test('navigates between slides via keyboard shortcuts', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-nav-keyboard', browserName, 1);
    await writeMultiSlideDoc(page);

    const overlay = await openPresenter(page);

    await expect(overlay.getByText('1 / 3')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(overlay.getByText('2 / 3')).toBeVisible();

    await page.keyboard.press('End');
    await expect(overlay.getByText('3 / 3')).toBeVisible();

    await page.keyboard.press('Home');
    await expect(overlay.getByText('1 / 3')).toBeVisible();

    // ArrowLeft on the first slide is clamped — counter stays at 1 / 3.
    await page.keyboard.press('ArrowLeft');
    await expect(overlay.getByText('1 / 3')).toBeVisible();
  });
});

test.describe('Presenter Mode mobile', () => {
  test.use({ viewport: { width: 500, height: 1200 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hides the Present option on small mobile viewports', async ({
    page,
  }) => {
    await mockedDocument(page, {
      abilities: {
        destroy: true,
        link_configuration: true,
        versions_destroy: true,
        versions_list: true,
        versions_retrieve: true,
        accesses_manage: true,
        accesses_view: true,
        update: true,
        partial_update: true,
        retrieve: true,
      },
    });

    await goToGridDoc(page);

    await page.getByLabel('Open the document options').click();
    await expect(page.getByRole('menuitem', { name: 'Present' })).toBeHidden();
  });
});
