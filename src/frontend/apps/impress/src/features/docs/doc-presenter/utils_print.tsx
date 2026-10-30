import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import { NextRouter } from 'next/router';
import { Root, createRoot } from 'react-dom/client';

import {
  wrapInterlinksWithAnchor,
  wrapMediaWithLink,
} from '@/docs/doc-export/utils_print';
import { KEY_DOC } from '@/docs/doc-management';

import {
  PRESENTER_PRINT_CSS,
  PRESENTER_PRINT_ROOT_ID,
  PRESENTER_PRINT_STYLES_ID,
  PresenterPrintDocument,
} from './components/PresenterPrintDocument';
import { PresenterSlideData } from './types';

const PRINT_CLEANUP_DELAY_MS = 10000;
const PRINT_IMAGE_WAIT_TIMEOUT_MS = 2000;
const PRINT_DOC_QUERY_WAIT_TIMEOUT_MS = 3000;

/**
 * The print root is mounted with its own `createRoot`, outside the app tree, so
 * it does not inherit the app providers. Slide content needs some of them, e.g.
 * interlinks resolve the linked doc title with React Query and the router.
 */
export interface PresenterPrintProviders {
  queryClient: QueryClient;
  router: NextRouter;
}

interface PresenterPrintMount {
  cleanup: () => void;
  container: HTMLDivElement;
  root: Root;
}

const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const timeout = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const removeExistingPrintArtifacts = () => {
  document.getElementById(PRESENTER_PRINT_ROOT_ID)?.remove();
  document.getElementById(PRESENTER_PRINT_STYLES_ID)?.remove();
};

const createPrintStyleElement = () => {
  const style = document.createElement('style');
  style.id = PRESENTER_PRINT_STYLES_ID;
  style.textContent = PRESENTER_PRINT_CSS;
  return style;
};

const waitForImages = async (container: HTMLElement) => {
  const images = Array.from(container.querySelectorAll('img'));
  if (images.length === 0) {
    return;
  }

  const imagePromises = images.map(
    (image) =>
      new Promise<void>((resolve) => {
        if (image.complete) {
          resolve();
          return;
        }

        const done = () => {
          image.removeEventListener('load', done);
          image.removeEventListener('error', done);
          resolve();
        };

        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
      }),
  );

  await Promise.race([
    Promise.all(imagePromises).then(() => undefined),
    timeout(PRINT_IMAGE_WAIT_TIMEOUT_MS),
  ]);
};

export const mountPresenterPrintSlides = (
  slides: PresenterSlideData[],
  { queryClient, router }: PresenterPrintProviders,
): PresenterPrintMount => {
  removeExistingPrintArtifacts();

  const style = createPrintStyleElement();
  const container = document.createElement('div');
  container.id = PRESENTER_PRINT_ROOT_ID;

  document.head.appendChild(style);
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterContext.Provider value={router}>
        <PresenterPrintDocument slides={slides} />
      </RouterContext.Provider>
    </QueryClientProvider>,
  );

  return {
    container,
    root,
    cleanup: () => {
      root.unmount();
      container.remove();
      style.remove();
    },
  };
};

// The slides are mounted off-screen via createRoot, then their content
// (BlockNote/ProseMirror) lays out asynchronously. We wait two paint frames so
// React commits the render and the editor settles before measuring images,
// then one more after images load. Do NOT collapse these into a single frame:
// printing too early yields blank pages. `printPresenterSlides` adds a final
// frame after the media/interlink wrapping for the same reason.
export const waitForPresenterPrintReady = async (container: HTMLElement) => {
  await nextFrame();
  await nextFrame();
  await waitForImages(container);
  await nextFrame();
};

// Interlinks whose title is not cached yet (or failed to load before) render a
// loader until their query settles, so wait for it to print the title or the
// fallback label instead.
const waitForDocQueries = async (queryClient: QueryClient) => {
  const deadline = Date.now() + PRINT_DOC_QUERY_WAIT_TIMEOUT_MS;
  while (
    queryClient.isFetching({ queryKey: [KEY_DOC] }) > 0 &&
    Date.now() < deadline
  ) {
    await nextFrame();
  }
};

export const printPresenterSlides = async (
  slides: PresenterSlideData[],
  providers: PresenterPrintProviders,
) => {
  if (typeof window === 'undefined') {
    return;
  }

  const { cleanup, container } = mountPresenterPrintSlides(slides, providers);
  const scopedCleanups: Array<() => void> = [];
  let cleaned = false;
  let fallbackTimer: number | undefined;
  const cleanupOnce = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    window.clearTimeout(fallbackTimer);
    window.removeEventListener('afterprint', cleanupOnce);
    scopedCleanups.splice(0).forEach((scopedCleanup) => scopedCleanup());
    cleanup();
  };

  try {
    window.addEventListener('afterprint', cleanupOnce, { once: true });
    await waitForPresenterPrintReady(container);
    await waitForDocQueries(providers.queryClient);
    scopedCleanups.push(wrapInterlinksWithAnchor(container));
    scopedCleanups.push(wrapMediaWithLink(container));
    await nextFrame();
    window.print();
    // Fallback in case `afterprint` never fires (some browsers/headless).
    fallbackTimer = window.setTimeout(cleanupOnce, PRINT_CLEANUP_DELAY_MS);
  } catch (error) {
    cleanupOnce();
    throw error;
  }
};
