import path from 'path';

import { Locator, Page, expect, test } from '@playwright/test';
import { PDFParse } from 'pdf-parse';

import {
  createDoc,
  goToGridDoc,
  mockedDocument,
  saveContent,
} from './utils-common';
import {
  openSuggestionMenu,
  tryFocusEditorContent,
  writeInEditor,
} from './utils-editor';

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

const insertImageInCurrentBlock = async (page: Page) => {
  const fileChooserPromise = page.waitForEvent('filechooser');

  await tryFocusEditorContent({ page });
  await page.keyboard.type('/');
  await page
    .locator('.bn-suggestion-menu')
    .getByText('Resizable image with caption', { exact: true })
    .click();
  await page.getByText('Upload image').click();

  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(
    path.join(__dirname, 'assets/logo-suite-numerique.png'),
  );

  const image = page
    .locator('.--docs--editor-container img.bn-visual-media')
    .first();
  await expect(image).toBeVisible({ timeout: 10000 });
  return image;
};

const getDocIdFromUrl = (page: Page) => {
  const id = /\/docs\/([^/?]+)/.exec(page.url())?.[1];
  if (!id) {
    throw new Error(`Could not extract doc id from URL: ${page.url()}`);
  }
  return id;
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

const stubPrintDialog = async (page: Page) => {
  await page.evaluate(() => {
    window.print = () => undefined;
  });
};

const finishStubbedPrintDialog = async (page: Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('afterprint'));
  });
};

const openPresenterActions = async (page: Page, overlay: Locator) => {
  await overlay.getByRole('button', { name: 'More options' }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Copy link to slide' }),
  ).toBeVisible();
  await expect(
    page.getByRole('menuitem', { name: 'Download PDF' }),
  ).toBeVisible();
};

const copyCurrentPresenterSlideLink = async (page: Page, overlay: Locator) => {
  await openPresenterActions(page, overlay);
  await page.getByRole('menuitem', { name: 'Copy link to slide' }).click();
};

const exportPresenterPdf = async (page: Page, overlay: Locator) => {
  await openPresenterActions(page, overlay);
  await page.getByRole('menuitem', { name: 'Download PDF' }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Presenter Mode', () => {
  // Step out of the suite-wide fullyParallel mode: these tests create and edit
  // docs that race the editor/persistence layer under heavy parallelism. Run
  // them sequentially within the file (each test is still fully independent —
  // no shared state — so this is `default`, not `serial`).
  test.describe.configure({ mode: 'default' });

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
    await expect(overlay.getByText(/presenter-open/)).toBeVisible();
    await expect(
      overlay.getByText(
        'You can use the divider to tell Docs where to split your slides',
      ),
    ).toBeVisible();
    await overlay.getByRole('button', { name: 'Next slide' }).click();
    await expect(overlay.getByText('Hello presenter')).toBeVisible();

    // The presenter calls requestFullscreen on open. usePresenterShortcuts
    // deliberately ignores Escape while in fullscreen (the browser owns Esc
    // there to exit). Playwright grants requestFullscreen but, unlike a real
    // browser, does NOT dispatch a fullscreen exit on Escape — so we must
    // exit fullscreen ourselves before pressing Escape to test the close
    // path. We also wait for the React state to settle after the exit so
    // the keydown listener is re-bound with isFullscreen=false.
    await page.evaluate(async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    });
    await page.waitForFunction(() => document.fullscreenElement === null);
    await expect(
      overlay.getByRole('button', { name: 'Enter fullscreen' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('moves focus onto the first available control when opened', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-focus', browserName, 1);
    await writeMultiSlideDoc(page);

    const overlay = await openPresenter(page);

    // On the first slide, "Previous" is disabled, so focus lands on "Next".
    await expect(
      overlay.getByRole('button', { name: 'Next slide' }),
    ).toBeFocused();
  });

  test('announces the slide position through a live region and exposes a slide role description', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-a11y', browserName, 1);
    await writeMultiSlideDoc(page);

    const overlay = await openPresenter(page);

    // The visible "1 / 4" counter is decorative (aria-hidden); the position is
    // announced through a polite live region for screen readers instead.
    // react-aria/live-announcer creates a global role="log" div on document.body
    // (outside the dialog), so we query from `page`, not `overlay`.
    const liveRegion = page.locator(
      '[data-live-announcer="true"] [aria-live="polite"]',
    );
    // The title slide uses the document title, then content slides use the
    // first text block (getSlideTitle).
    await expect(liveRegion).toContainText('Slide 1 of 4:');

    await overlay.getByRole('button', { name: 'Next slide' }).click();
    await expect(liveRegion).toContainText('Slide 2 of 4: Slide one');

    // Each slide advertises a localized role description for screen readers.
    await expect(overlay.getByRole('group').first()).toHaveAttribute(
      'aria-roledescription',
      'slide',
    );
  });

  test('renders a content-only doc after the generated title slide', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-single', browserName, 1);
    await writeInEditor({ page, text: 'Slide A' });

    const overlay = await openPresenter(page);

    await expect(overlay.getByText('1 / 2')).toBeVisible();
    await expect(
      overlay.getByRole('button', { name: 'Previous slide' }),
    ).toBeDisabled();
    await expect(
      overlay.getByRole('button', { name: 'Next slide' }),
    ).toBeEnabled();

    await overlay.getByRole('button', { name: 'Next slide' }).click();
    await expect(overlay.getByText('2 / 2')).toBeVisible();
    await expect(overlay.getByText('Slide A')).toBeVisible();
    await expect(
      overlay.getByRole('button', { name: 'Next slide' }),
    ).toBeDisabled();

    await overlay.getByRole('button', { name: 'Close presenter' }).click();
    await expect(overlay).toBeHidden();
  });

  test('does not show selected-node chrome when the first slide block is an image', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-image-first', browserName, 1);
    await insertImageInCurrentBlock(page);

    const overlay = await openPresenter(page);
    await overlay.getByRole('button', { name: 'Next slide' }).click();
    const presenterImage = overlay.locator('img.bn-visual-media').first();
    await expect(presenterImage).toBeAttached({ timeout: 10000 });

    const outline = await presenterImage.evaluate((img) => {
      const blockContent = img.closest('.bn-block-content');
      blockContent?.classList.add('ProseMirror-selectednode');

      const outlinedElement =
        (blockContent?.firstElementChild as HTMLElement | null) ??
        (img as HTMLElement);
      const style = getComputedStyle(outlinedElement);

      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });

    expect(outline).toEqual({
      outlineStyle: 'none',
      outlineWidth: '0px',
    });
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

    await expect(overlay.getByText('1 / 4')).toBeVisible();
    await expect(overlay.getByText(/presenter-nav-bar/)).toBeVisible();
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();

    await next.click();
    await expect(overlay.getByText('2 / 4')).toBeVisible();
    await expect(overlay.getByText('Slide one')).toBeVisible();

    await next.click();
    await expect(overlay.getByText('3 / 4')).toBeVisible();
    await expect(overlay.getByText('Slide two')).toBeVisible();

    await next.click();
    await expect(overlay.getByText('4 / 4')).toBeVisible();
    await expect(overlay.getByText('Slide three')).toBeVisible();
    await expect(next).toBeDisabled();
    await expect(prev).toBeEnabled();

    await prev.click();
    await expect(overlay.getByText('3 / 4')).toBeVisible();
    await expect(overlay.getByText('Slide two')).toBeVisible();
  });

  test('navigates between slides via keyboard shortcuts', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-nav-keyboard', browserName, 1);
    await writeMultiSlideDoc(page);

    const overlay = await openPresenter(page);

    await expect(overlay.getByText('1 / 4')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(overlay.getByText('2 / 4')).toBeVisible();

    await page.keyboard.press('End');
    await expect(overlay.getByText('4 / 4')).toBeVisible();

    await page.keyboard.press('Home');
    await expect(overlay.getByText('1 / 4')).toBeVisible();

    // ArrowLeft on the first slide is clamped — counter stays at 1 / 4.
    await page.keyboard.press('ArrowLeft');
    await expect(overlay.getByText('1 / 4')).toBeVisible();
  });

  test('scales each slide to fit the viewport (outer width = 900 × scale)', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-scaling', browserName, 1);
    await writeInEditor({ page, text: 'A short slide' });

    const overlay = await openPresenter(page);
    const currentSlide = overlay.getByRole('group').filter({ hasNotText: '' });
    await expect(currentSlide.first()).toBeVisible();

    const dims = await currentSlide.first().evaluate((el) => {
      // DOM: <outer role="group"><stage><inner (scaled)>...
      const stage = el.firstElementChild as HTMLElement | null;
      const inner = stage?.firstElementChild as HTMLElement | null;
      const innerStyle = inner ? getComputedStyle(inner) : null;
      return {
        outerWidth: el.getBoundingClientRect().width,
        innerTransform: innerStyle?.transform ?? 'none',
      };
    });

    // Inner has `transform: scale(<n>)`; match the first scale matrix value.
    const m = /matrix\(([-\d.]+)/.exec(dims.innerTransform);
    expect(
      m,
      `expected a scale matrix, got: ${dims.innerTransform}`,
    ).not.toBeNull();

    const scale = m ? parseFloat(m[1]) : NaN;

    // Scale is always clamped to [MIN_SCALE, MAX_SCALE] = [0.7, 1.5].
    // The exact value depends on viewport: sparse content typically saturates
    // the height-based scale (→ MAX), but at default Playwright viewport
    // (1280) the width path can constrain to scaleW = (1280 - 2*paddingX)/900.
    // We assert the bounds, not a specific value.
    expect(scale).toBeGreaterThanOrEqual(0.7);
    expect(scale).toBeLessThanOrEqual(1.5);

    // The core invariant: outer width = DESIGN_WIDTH (900) × scale,
    // within a 5px tolerance for sub-pixel rounding.
    expect(Math.abs(dims.outerWidth - 900 * scale)).toBeLessThan(5);
  });

  test('tall slide produces a vertical scrollbar on the outer wrapper with the top visible', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-tall', browserName, 1);

    // Build a tall single-slide doc: many headings + paragraphs so the
    // natural content height blows past viewport height at MIN_SCALE.
    const editor = await writeInEditor({ page, text: 'TOP MARKER' });
    for (let i = 0; i < 40; i += 1) {
      await editor.press('Enter');
      await editor.pressSequentially(`Filler line ${i} to make the slide tall`);
    }

    const overlay = await openPresenter(page);
    await overlay.getByRole('button', { name: 'Next slide' }).click();
    const slide = overlay
      .getByRole('group')
      .filter({ hasText: 'TOP MARKER' })
      .first();
    await expect(slide).toBeVisible();

    // The first block ('TOP MARKER') must be at y=0 of the slide wrapper
    // (i.e. visible at the top, not clipped). This is the regression we fix.
    const topVisible = await slide.evaluate((el) => {
      el.scrollTop = 0;
      const first = el.querySelector('.bn-block-content');
      if (!first) {
        return { ok: false, reason: 'no first block' };
      }
      const slideRect = el.getBoundingClientRect();
      const blockRect = first.getBoundingClientRect();
      return {
        ok: blockRect.top >= slideRect.top - 1,
        slideTop: slideRect.top,
        blockTop: blockRect.top,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    });

    expect(topVisible.ok, JSON.stringify(topVisible)).toBe(true);
    expect(topVisible.scrollHeight ?? 0).toBeGreaterThan(
      topVisible.clientHeight ?? 0,
    );
  });

  test('opens the presenter at the targeted slide from a block side menu', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-side-menu', browserName, 1);
    await writeMultiSlideDoc(page);

    // Reveal the block side menu for the "Slide two" paragraph, then trigger its
    // drag-handle "Present" action.
    await page
      .locator('.bn-block-outer')
      .filter({ hasText: 'Slide two' })
      .first()
      .hover();
    await page.locator('.bn-side-menu > button').last().click();
    await page.getByRole('menuitem', { name: 'Present' }).click();

    // "Slide two" is the 2nd content slide; with the generated title slide
    // first that is slide 3 of 4.
    const overlay = page.getByRole('dialog', { name: 'Presenter mode' });
    await expect(overlay).toBeVisible();
    await expect(overlay.getByText('3 / 4')).toBeVisible();
    await expect(overlay.getByText('Slide two')).toBeVisible();
  });

  test('deep-link ?view=present&slide=3 opens the presenter at content slide 2', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(
      page,
      'presenter-deeplink',
      browserName,
      1,
    );
    await writeMultiSlideDoc(page);
    const docId = getDocIdFromUrl(page);

    // Ensure the typed content is persisted (awaits the PATCH /content/) before
    // we reload the page through the deep-link, instead of a fixed sleep.
    await saveContent(page, docTitle);
    await page.goto(`/docs/${docId}/?view=present&slide=3`);

    const overlay = page.getByRole('dialog', { name: 'Presenter mode' });
    await expect(overlay).toBeVisible({ timeout: 15000 });
    await expect(overlay.getByText('3 / 4')).toBeVisible();
    await expect(overlay.getByText('Slide two')).toBeVisible();
  });

  test('deep-link with an out-of-range slide clamps to the last slide and rewrites the URL', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(
      page,
      'presenter-deeplink-oob',
      browserName,
      1,
    );
    await writeMultiSlideDoc(page);
    const docId = getDocIdFromUrl(page);

    await saveContent(page, docTitle);
    await page.goto(`/docs/${docId}/?view=present&slide=99`);

    const overlay = page.getByRole('dialog', { name: 'Presenter mode' });
    await expect(overlay).toBeVisible({ timeout: 15000 });
    await expect(overlay.getByText('4 / 4')).toBeVisible();
    // The address bar self-corrects to the real slide.
    await expect.poll(() => page.url()).toContain('slide=4');
  });

  test('deep-link with an invalid slide param falls back to the first slide', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(
      page,
      'presenter-deeplink-invalid',
      browserName,
      1,
    );
    await writeMultiSlideDoc(page);
    const docId = getDocIdFromUrl(page);

    await saveContent(page, docTitle);
    await page.goto(`/docs/${docId}/?view=present&slide=abc`);

    const overlay = page.getByRole('dialog', { name: 'Presenter mode' });
    await expect(overlay).toBeVisible({ timeout: 15000 });
    await expect(overlay.getByText('1 / 4')).toBeVisible();
  });

  test('shows a confirmation toast when copying the current-slide link', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-copy-link', browserName, 1);
    await writeMultiSlideDoc(page);

    const overlay = await openPresenter(page);
    await overlay.getByRole('button', { name: 'Next slide' }).click();
    await expect(overlay.getByText('2 / 4')).toBeVisible();

    await copyCurrentPresenterSlideLink(page, overlay);
    await expect(page.getByText('Link Copied !')).toBeVisible();
  });

  test('copies a deep-link pointing to the current slide', async ({
    page,
    browserName,
    context,
  }) => {
    // Clipboard read-back is only reliable on Chromium with granted permissions.
    test.skip(
      browserName !== 'chromium',
      'Clipboard read-back is Chromium-only',
    );
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await createDoc(page, 'presenter-copy-link-content', browserName, 1);
    await writeMultiSlideDoc(page);
    const docId = getDocIdFromUrl(page);

    const overlay = await openPresenter(page);
    await overlay.getByRole('button', { name: 'Next slide' }).click();
    await expect(overlay.getByText('2 / 4')).toBeVisible();

    await copyCurrentPresenterSlideLink(page, overlay);
    await expect(page.getByText('Link Copied !')).toBeVisible();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain(`/docs/${docId}/?view=present&slide=2`);
  });

  test('syncs the slide to the URL while navigating', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-url-sync', browserName, 1);
    await writeMultiSlideDoc(page);

    const overlay = await openPresenter(page);
    // Opening writes slide=1 to the address bar.
    await expect.poll(() => page.url()).toContain('view=present');
    await expect.poll(() => page.url()).toContain('slide=1');

    await overlay.getByRole('button', { name: 'Next slide' }).click();
    await expect(overlay.getByText('2 / 4')).toBeVisible();
    await expect.poll(() => page.url()).toContain('slide=2');
  });

  test('strips the present query params when closing', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-url-strip', browserName, 1);
    await writeInEditor({ page, text: 'Slide A' });

    const overlay = await openPresenter(page);
    await expect.poll(() => page.url()).toContain('view=present');

    await overlay.getByRole('button', { name: 'Close presenter' }).click();
    await expect(overlay).toBeHidden();
    await expect.poll(() => page.url()).not.toContain('view=present');
    await expect.poll(() => page.url()).not.toContain('slide=');
    // The editor is still mounted (shallow routing, no full reload).
    await expect(page.locator('.--docs--editor-container')).toBeVisible();
  });

  test('exports every presenter slide through browser print as landscape PDF pages', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'page.pdf() is only available on Chromium',
    );

    await createDoc(page, 'presenter-print-pdf', browserName, 1);
    await writeMultiSlideDoc(page);

    const overlay = await openPresenter(page);
    await stubPrintDialog(page);

    await exportPresenterPdf(page, overlay);

    await expect(page.locator('#presenter-print-styles')).toBeAttached();
    await expect(page.locator('[data-presenter-print-page]')).toHaveCount(4);

    await page.emulateMedia({ media: 'print' });
    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
    });
    await page.emulateMedia({ media: 'screen' });

    const pdfParse = new PDFParse({ data: pdfBuffer });
    const pdfInfo = await pdfParse.getInfo({ parsePageInfo: true });
    const pdfText = await pdfParse.getText();
    await pdfParse.destroy();

    expect(pdfInfo.total).toBe(4);
    expect(pdfInfo.pages).toHaveLength(4);
    pdfInfo.pages.forEach((pdfPage) => {
      expect(pdfPage.width).toBeGreaterThan(pdfPage.height);
    });
    expect(pdfText.text).toContain('Slide one');
    expect(pdfText.text).toContain('Slide two');
    expect(pdfText.text).toContain('Slide three');

    await finishStubbedPrintDialog(page);
    await expect(page.locator('#presenter-print-styles')).not.toBeAttached({
      timeout: 5000,
    });
  });

  test('renders file blocks as printable links in presenter export', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-print-file-link', browserName, 1);
    await writeInEditor({ page, text: 'Slide with a file' });

    const fileChooserPromise = page.waitForEvent('filechooser');
    const responseCheckPromise = page.waitForResponse(
      (response) =>
        response.url().includes('media-check') && response.status() === 200,
    );

    await openSuggestionMenu({
      page,
      suggestion: 'Embedded file',
    });
    await page.getByText('Upload file').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'assets/test.html'));
    await responseCheckPromise;

    await expect(
      page.locator('.bn-block-content[data-name="test.html"]'),
    ).toBeVisible();

    const overlay = await openPresenter(page);
    await stubPrintDialog(page);

    await exportPresenterPdf(page, overlay);

    const printFileBlock = page.locator(
      '#presenter-print-root [data-content-type="file"][data-name="test.html"]',
    );
    await expect(printFileBlock).toBeAttached();

    const printLinkText = await printFileBlock.evaluate((el) => {
      const shadowRoot = el.firstElementChild?.shadowRoot;
      return shadowRoot?.textContent ?? '';
    });

    expect(printLinkText).toContain('test.html');

    await finishStubbedPrintDialog(page);
    await expect(page.locator('#presenter-print-styles')).not.toBeAttached({
      timeout: 5000,
    });
  });

  test('clips a tall content slide to a single printed page after the title page', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'page.pdf() is only available on Chromium',
    );

    await createDoc(page, 'presenter-print-tall', browserName, 1);

    const editor = await writeInEditor({ page, text: 'TOP PRINT MARKER' });
    for (let i = 0; i < 45; i += 1) {
      await editor.press('Enter');
      await editor.pressSequentially(`Printed filler line ${i}`);
    }

    const overlay = await openPresenter(page);
    await stubPrintDialog(page);

    await exportPresenterPdf(page, overlay);

    await expect(page.locator('#presenter-print-styles')).toBeAttached();
    await expect(page.locator('[data-presenter-print-page]')).toHaveCount(2);

    await page.emulateMedia({ media: 'print' });
    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
    });
    await page.emulateMedia({ media: 'screen' });

    const pdfParse = new PDFParse({ data: pdfBuffer });
    const pdfInfo = await pdfParse.getInfo({ parsePageInfo: true });
    const pdfText = await pdfParse.getText();
    await pdfParse.destroy();

    expect(pdfInfo.total).toBe(2);
    expect(pdfInfo.pages[0].width).toBeGreaterThan(pdfInfo.pages[0].height);
    expect(pdfText.text).toContain('TOP PRINT MARKER');

    await finishStubbedPrintDialog(page);
    await expect(page.locator('#presenter-print-styles')).not.toBeAttached({
      timeout: 5000,
    });
  });
});

test.describe('Presenter Mode mobile', () => {
  test.describe.configure({ mode: 'default' });
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

  test('ignores a ?view=present deep-link on small mobile viewports', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'presenter-mobile-deeplink', browserName, 1, true);
    await writeInEditor({ page, text: 'Slide A' });
    const docId = getDocIdFromUrl(page);

    // No persistence wait needed: this asserts the deep-link is ignored on
    // mobile, which does not depend on the typed content being saved.
    await page.goto(`/docs/${docId}/?view=present&slide=1`);

    // The editor loads normally...
    await expect(page.locator('.--docs--editor-container')).toBeVisible({
      timeout: 15000,
    });
    // ...but the presenter is never auto-opened on mobile.
    await expect(
      page.getByRole('dialog', { name: 'Presenter mode' }),
    ).toBeHidden();
  });
});
