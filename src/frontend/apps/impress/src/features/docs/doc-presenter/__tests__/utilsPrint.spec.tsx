import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { NextRouter } from 'next/router';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { KEY_DOC } from '@/docs/doc-management';

import type { PresenterBlock } from '../types';
import {
  mountPresenterPrintSlides,
  printPresenterSlides,
} from '../utils_print';

const LINKED_DOC_ID = 'a1b2c3d4-e5f6-4789-a123-1234567890ab';

const interlinkParagraph: PresenterBlock = {
  children: [],
  content: [
    { type: 'text', text: 'See ', styles: {} },
    {
      type: 'interlinkingLinkInline',
      props: { docId: LINKED_DOC_ID, blockId: '', disabled: false },
    },
  ],
  id: 'paragraph',
  props: {
    backgroundColor: 'default',
    textAlignment: 'left',
    textColor: 'default',
  },
  type: 'paragraph',
} as unknown as PresenterBlock;

describe('mountPresenterPrintSlides', () => {
  let cleanup: (() => void) | undefined;

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
    cleanup?.();
    cleanup = undefined;
    vi.restoreAllMocks();
  });

  test('renders interlinks with the title of the linked doc', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData([KEY_DOC, { id: LINKED_DOC_ID }], {
      id: LINKED_DOC_ID,
      title: 'Linked doc',
    });

    const mount = mountPresenterPrintSlides(
      [{ kind: 'content', blocks: [interlinkParagraph] }],
      { queryClient, router: { push: vi.fn() } as unknown as NextRouter },
    );
    cleanup = mount.cleanup;

    await waitFor(() => {
      expect(
        mount.container.querySelector(
          '.--docs--interlinking-link-inline-content',
        ),
      ).toHaveTextContent('Linked doc');
    });
    expect(
      mount.container
        .querySelector('.--docs--interlinking-link-inline-content')
        ?.getAttribute('data-href'),
    ).toBe(`/docs/${LINKED_DOC_ID}/`);
  });

  test('prints the fallback label of an interlink whose doc cannot be loaded', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ detail: 'Forbidden' }), {
                  status: 403,
                }),
              ),
            200,
          );
        }),
    );
    let printedLabel: string | null | undefined;
    vi.spyOn(window, 'print').mockImplementation(() => {
      printedLabel = document.querySelector(
        '.--docs--interlinking-link-inline-content',
      )?.textContent;
      window.dispatchEvent(new Event('afterprint'));
    });

    await printPresenterSlides(
      [{ kind: 'content', blocks: [interlinkParagraph] }],
      {
        queryClient: new QueryClient({
          defaultOptions: { queries: { retry: false } },
        }),
        router: { push: vi.fn() } as unknown as NextRouter,
      },
    );

    expect(printedLabel).toBe(`/${LINKED_DOC_ID}/`);
  });
});
