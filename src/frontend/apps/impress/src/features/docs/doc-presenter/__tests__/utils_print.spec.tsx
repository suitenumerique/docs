import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  PRESENTER_PRINT_PAGE_SELECTOR,
  PRESENTER_PRINT_ROOT_ID,
  PRESENTER_PRINT_TITLE_CLASS,
} from '../components/PresenterPrintDocument';
import type { PresenterBlock, PresenterSlideData } from '../types';
import { printPresenterSlides } from '../utils_print';

const para = (text: string): PresenterBlock => ({
  children: [],
  content: [{ type: 'text', text, styles: {} }],
  id: 'paragraph',
  props: {
    backgroundColor: 'default',
    textAlignment: 'left',
    textColor: 'default',
  },
  type: 'paragraph',
});

describe('printPresenterSlides', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('omits title slide from print container when exporting slides', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const mockSlides: PresenterSlideData[] = [
      {
        kind: 'title',
        title: 'Document Cover Title',
        showDividerHint: false,
      },
      {
        kind: 'content',
        blocks: [para('First slide content')],
      },
      {
        kind: 'content',
        blocks: [para('Second slide content')],
      },
    ];

    await printPresenterSlides(mockSlides);

    expect(printSpy).toHaveBeenCalledTimes(1);

    const printRoot = document.getElementById(PRESENTER_PRINT_ROOT_ID);
    expect(printRoot).not.toBeNull();

    expect(
      printRoot?.querySelector(`.${PRESENTER_PRINT_TITLE_CLASS}`),
    ).toBeNull();
    expect(printRoot?.textContent).not.toContain('Document Cover Title');

    const printedPages = printRoot?.querySelectorAll(
      PRESENTER_PRINT_PAGE_SELECTOR,
    );
    expect(printedPages).toHaveLength(2);

    window.dispatchEvent(new Event('afterprint'));
    expect(document.getElementById(PRESENTER_PRINT_ROOT_ID)).toBeNull();
  });
});
