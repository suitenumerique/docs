import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  PRESENTER_PRINT_CONTENT_CLASS,
  PRESENTER_PRINT_CSS,
  PRESENTER_PRINT_LOGO_CLASS,
  PRESENTER_PRINT_PAGE_CLASS,
  PRESENTER_PRINT_PAGE_SELECTOR,
  PRESENTER_PRINT_TITLE_CLASS,
  PresenterPrintDocument,
} from '../components/PresenterPrintDocument';

type TestBlock = {
  type: string;
  content?: { type: 'text'; text: string; styles: Record<string, never> }[];
};

const para = (text: string): TestBlock => ({
  type: 'paragraph',
  content: [{ type: 'text', text, styles: {} }],
});

describe('PresenterPrintDocument', () => {
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

  test('renders one print page per slide', () => {
    const { container } = render(
      <PresenterPrintDocument
        slides={[
          { kind: 'title', title: 'Deck title', showDividerHint: false },
          { kind: 'content', blocks: [para('Slide one')] },
          { kind: 'content', blocks: [para('Slide two')] },
          { kind: 'content', blocks: [] },
        ]}
      />,
    );

    expect(
      container.querySelectorAll(PRESENTER_PRINT_PAGE_SELECTOR),
    ).toHaveLength(4);
    expect(
      container.querySelector(`.${PRESENTER_PRINT_TITLE_CLASS}`),
    ).toHaveTextContent('Deck title');
    expect(
      container.querySelectorAll(`.${PRESENTER_PRINT_LOGO_CLASS}`),
    ).toHaveLength(4);
  });

  test('centers short slide content vertically in print pages', () => {
    expect(PRESENTER_PRINT_CSS).toContain(`.${PRESENTER_PRINT_PAGE_CLASS} {`);
    expect(PRESENTER_PRINT_CSS).toContain('justify-content: safe center;');
    expect(PRESENTER_PRINT_CSS).toContain(
      `.${PRESENTER_PRINT_CONTENT_CLASS} {`,
    );
    expect(PRESENTER_PRINT_CSS).toContain('max-height: 100%;');
  });
});
