import { QueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { defaultOptions } from '@/core';
import { KEY_DOC } from '@/docs/doc-management';
// The slides render in their own root, out of the app providers
import '@/i18n/initI18n';

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
    act(() => cleanup?.());
    cleanup = undefined;
    vi.restoreAllMocks();
  });

  test('renders interlinks with the title of the linked doc', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData([KEY_DOC, { id: LINKED_DOC_ID }], {
      id: LINKED_DOC_ID,
      title: 'Linked doc',
    });

    let mount!: ReturnType<typeof mountPresenterPrintSlides>;
    act(() => {
      mount = mountPresenterPrintSlides(
        [{ kind: 'content', blocks: [interlinkParagraph] }],
        { queryClient },
      );
    });
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

  test.each([
    [403, 'No access'],
    [404, `/${LINKED_DOC_ID}/`],
  ])(
    'prints the label of an interlink whose doc cannot be loaded (%i)',
    async (status, expectedLabel) => {
      let respond!: (response: Response) => void;
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
        () =>
          new Promise((resolve) => {
            respond = resolve;
          }),
      );
      let printedLabel: string | null | undefined;
      vi.spyOn(window, 'print').mockImplementation(() => {
        printedLabel = document.querySelector(
          '.--docs--interlinking-link-inline-content',
        )?.textContent;
        // `afterprint` unmounts the slides.
        act(() => {
          window.dispatchEvent(new Event('afterprint'));
        });
      });

      const queryClient = new QueryClient({ defaultOptions });
      // Each step that renders runs in `act`. Printing is awaited after them,
      // out of `act`, so an update left over from a step still fails the test.
      let printing = Promise.resolve();
      act(() => {
        printing = printPresenterSlides(
          [{ kind: 'content', blocks: [interlinkParagraph] }],
          { queryClient },
        );
      });
      await act(async () => {
        await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      });
      await act(async () => {
        respond(new Response(JSON.stringify({ detail: 'Error' }), { status }));
        await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
      });
      await printing;

      expect(printedLabel).toBe(expectedLabel);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    },
  );
});
