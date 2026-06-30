import { expect, test } from '@playwright/test';

import {
  createDoc,
  goToGridDoc,
  openHeaderMenu,
  overrideConfig,
  verifyDocName,
} from './utils-common';
import { tryFocusEditorContent } from './utils-editor';
import { SignIn, expectLoginPage, logOut } from './utils-signin';
import { createRootSubPage } from './utils-sub-pages';

test.describe('Left panel desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checks all the elements are visible', async ({ page }) => {
    const leftPanel = page.getByLabel('Left panel');

    await expect(leftPanel.getByTestId('home-button')).toBeHidden();
    await expect(leftPanel.getByTestId('new-doc-button')).toBeVisible();
    await expect(leftPanel.getByLabel('User menu')).toBeVisible();
    await expect(leftPanel.getByLabel('Open help menu')).toBeVisible();

    await expect(leftPanel.getByTestId('header-logo-link')).toBeVisible();
    await expect(leftPanel.locator('h1').getByText('Docs')).toHaveCSS(
      'font-family',
      /Roboto/i,
    );

    await goToGridDoc(page);

    await expect(leftPanel.getByTestId('home-button')).toBeVisible();
  });

  test('checks all the elements are visible with DSFR theme', async ({
    page,
  }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'dsfr',
      theme_customization: {
        header: {
          icon: {
            src: '/assets/icon-docs-dsfr-v2.svg',
            style: {
              width: '100px',
              height: 'auto',
            },
            alt: '',
            withTitle: false,
            'data-testid': 'custom-testid-docs',
          },
        },
      },
    });
    await page.goto('/');

    const leftPanel = page.getByRole('navigation', { name: 'Left panel' });

    await expect(leftPanel.getByTestId('custom-testid-docs')).toHaveAttribute(
      'src',
      '/assets/icon-docs-dsfr-v2.svg',
    );
    // With withTitle: false, the h1 is kept for accessibility but visually hidden via sr-only
    await expect(leftPanel.locator('h1').getByText('Docs')).toHaveClass(
      /sr-only/,
    );
  });

  test('checks the left panel is correctly overrided', async ({ page }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'dsfr',
      theme_customization: {
        header: {
          icon: {
            src: '/assets/logo-gouv.svg',
            style: {
              width: '100px',
              height: 'auto',
            },
            alt: '',
          },
        },
      },
    });

    await page.goto('/');
    const leftPanel = page.getByRole('navigation', { name: 'Left panel' });

    const logoImage = leftPanel.getByTestId('header-icon-docs');
    await expect(logoImage).toBeVisible({
      timeout: 10000,
    });

    await expect(logoImage).not.toHaveAttribute('src', '/assets/icon-docs.svg');
    await expect(logoImage).toHaveAttribute('src', '/assets/logo-gouv.svg');
    await expect(logoImage).toHaveAttribute('alt', '');
  });

  test('checks a custom waffle', async ({ page }) => {
    await overrideConfig(page, {
      theme_customization: {
        waffle: {
          data: {
            services: [
              {
                name: 'Docs E2E Custom 1',
                url: 'https://docs.numerique.gouv.fr/',
                maturity: 'stable',
                logo: 'https://lasuite.numerique.gouv.fr/assets/products/docs.svg',
              },
              {
                name: 'Docs E2E Custom 2',
                url: 'https://docs.numerique.gouv.fr/',
                maturity: 'stable',
                logo: 'https://lasuite.numerique.gouv.fr/assets/products/docs.svg',
              },
            ],
          },
          showMoreLimit: 9,
        },
      },
    });

    await page.goto('/');

    const leftPanel = page.getByLabel('Left panel', { exact: true });

    await expect(
      leftPanel.getByRole('button', { name: 'Digital LaSuite services' }),
    ).toBeVisible();

    /**
     * The Waffle loads a js file from a remote server,
     * it takes some time to load the file and have the interaction available
     */
    await page.waitForTimeout(1500);

    await leftPanel
      .getByRole('button', { name: 'Digital LaSuite services' })
      .click();

    await expect(
      page.getByRole('link', { name: 'Docs E2E Custom 1' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Docs E2E Custom 2' }),
    ).toBeVisible();
  });

  test('checks the waffle dsfr', async ({ page }) => {
    await overrideConfig(page, {
      theme_customization: {
        waffle: {
          apiUrl: 'https://lasuite.numerique.gouv.fr/api/services',
          showMoreLimit: 9,
        },
      },
    });
    await page.goto('/');

    const leftPanel = page.getByLabel('Left panel', { exact: true });

    await expect(
      leftPanel.getByRole('button', { name: 'Digital LaSuite services' }),
    ).toBeVisible();

    /**
     * The Waffle loads a js file from a remote server,
     * it takes some time to load the file and have the interaction available
     */
    await page.waitForTimeout(1500);

    await leftPanel
      .getByRole('button', {
        name: 'Digital LaSuite services',
      })
      .click();

    await expect(page.getByRole('link', { name: 'Tchap' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Grist' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Visio' })).toBeVisible();
  });

  test('focuses page heading after switching the docs filter', async ({
    page,
  }) => {
    await page.goto('/');

    const myDocsLink = page.getByRole('link', { name: 'My docs' });
    await myDocsLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/target=my_docs/);

    const pageHeading = page.getByRole('heading', {
      name: 'My docs',
      level: 2,
    });
    await expect(pageHeading).toBeFocused();
  });

  test('checks resize handle is present and functional on document page', async ({
    page,
    browserName,
  }) => {
    // On home page, resize handle should NOT be present
    let resizeHandle = page.locator('[data-panel-resize-handle-id]');
    await expect(resizeHandle).toBeHidden();

    // Create and navigate to a document
    await createDoc(page, 'doc-resize-test', browserName, 1);

    // Now resize handle should be visible on document page
    resizeHandle = page.locator('[data-panel-resize-handle-id]').first();
    await expect(resizeHandle).toBeVisible();

    const leftPanel = page.getByTestId('left-panel');
    await expect(leftPanel).toBeVisible();

    // Get initial panel width
    const initialBox = await leftPanel.boundingBox();
    expect(initialBox).not.toBeNull();

    // Get handle position
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Test resize by dragging the handle
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handleBox!.x + 100,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.up();

    // Wait for resize to complete
    await page.waitForTimeout(200);

    // Verify the panel has been resized
    const newBox = await leftPanel.boundingBox();
    expect(newBox).not.toBeNull();
    expect(newBox!.width).toBeGreaterThan(initialBox!.width);
  });
});

test.describe('Left panel responsive', () => {
  test('checks elements visibility on different screen sizes', async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 500, height: 1200 });
    await page.goto('/');

    const header = page.locator('header').first();
    const leftPanel = page.getByLabel('Left panel', { exact: true });
    const homeButton = page.getByTestId('home-button');
    const newDocButton = page.getByTestId('new-doc-button');
    const userMenu = page.getByRole('button', {
      name: 'User menu',
    });

    await expect(leftPanel).not.toBeInViewport();
    await expect(homeButton).not.toBeInViewport();
    await expect(newDocButton).not.toBeInViewport();
    await expect(userMenu).not.toBeInViewport();

    await createDoc(page, 'mobile-doc-test', browserName, 1, true);

    await header.getByLabel(/Show the side panel/).click();

    await expect(leftPanel).toBeInViewport();
    await expect(homeButton).toBeInViewport();
    await expect(newDocButton).toBeInViewport();
    await expect(userMenu).toBeInViewport();

    await leftPanel.getByRole('button', { name: 'Close left panel' }).click();

    // Tablet size - like in desktop, left panel should be visible
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'All docs' })).toBeInViewport();
    await expect(newDocButton).toBeInViewport();
    await expect(userMenu).toBeInViewport();
    await expect(header.getByLabel('Toggle left panel')).toBeVisible();

    await page.setViewportSize({ width: 1100, height: 1200 });
    await page.goto('/');
    await expect(header.getByLabel('Toggle left panel')).toBeHidden();
  });

  test('checks panel closes when clicking on a subdoc', async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 500, height: 1200 });
    await page.goto('/');

    const [docTitle] = await createDoc(
      page,
      'mobile-doc-test',
      browserName,
      1,
      true,
    );

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'mobile-doc-test-child',
      true,
    );

    const { name: docChild2 } = await createRootSubPage(
      page,
      browserName,
      'mobile-doc-test-child-2',
      true,
    );

    await page.waitForTimeout(500);

    const leftPanel = page.getByLabel('Left panel', { exact: true });

    await expect(leftPanel).not.toBeInViewport();

    await openHeaderMenu(page);

    await expect(leftPanel).toBeInViewport({
      ratio: 1,
    });

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree.getByText(docTitle)).toBeVisible();
    await expect(docTree.getByText(docChild)).toBeVisible();
    await expect(docTree.getByText(docChild2)).toBeVisible();

    await docTree.getByText(docChild).click();
    await verifyDocName(page, docChild);
    await expect(leftPanel).not.toBeInViewport();
  });

  test('checks panel coordination on tablet sizes', async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.goto('/');

    await createDoc(page, 'tablet-doc-test', browserName, 1);

    const leftPanel = page.locator('.--docs--resizable-left-panel');
    const rightPanel = page.getByLabel('Table of contents side panel');

    // Initially, left panel should be visible and right panel should be hidden
    await expect(leftPanel).toBeInViewport();
    await expect(rightPanel).not.toBeInViewport();
    await tryFocusEditorContent({ page });
    await page.keyboard.type('# Level 1');

    // Open right panel, the left panel should hide
    await page
      .getByRole('button', { name: 'Show the table of contents sidebar' })
      .click();
    await expect(rightPanel).toBeInViewport();
    await expect(leftPanel).toBeHidden();

    // Open left panel, the right panel should hide
    await page.getByRole('button', { name: /Show the side panel/ }).click();
    await expect(leftPanel).toBeInViewport();
    await expect(rightPanel).not.toBeInViewport();

    // Close the left panel, the right panel should show
    await page.getByRole('button', { name: /Hide the side panel/ }).click();
    await expect(leftPanel).toBeHidden();
    await expect(rightPanel).toBeInViewport();

    // Close right panel, the left panel should stay closed
    await page
      .getByRole('button', { name: 'Hide the table of contents sidebar' })
      .click();
    await expect(rightPanel).not.toBeInViewport();
    await expect(leftPanel).toBeHidden();
  });
});

test.describe('Left Panel: Log out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // eslint-disable-next-line playwright/expect-expect
  test('checks logout button', async ({ page, browserName }) => {
    await page.goto('/');
    await SignIn(page, browserName);
    await logOut(page);

    await expectLoginPage(page);
  });
});
