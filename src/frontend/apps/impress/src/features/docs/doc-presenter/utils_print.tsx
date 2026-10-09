import { Root, createRoot } from 'react-dom/client';

import {
  wrapInterlinksWithAnchor,
  wrapMediaWithLink,
} from '@/docs/doc-export/utils_print';

import {
  PRESENTER_PRINT_CSS,
  PRESENTER_PRINT_ROOT_ID,
  PRESENTER_PRINT_STYLES_ID,
  PresenterPrintDocument,
} from './components/PresenterPrintDocument';
import { PresenterSlideData } from './types';

const PRINT_CLEANUP_DELAY_MS = 10000;
const PRINT_IMAGE_WAIT_TIMEOUT_MS = 2000;

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
): PresenterPrintMount => {
  removeExistingPrintArtifacts();

  const style = createPrintStyleElement();
  const container = document.createElement('div');
  container.id = PRESENTER_PRINT_ROOT_ID;

  document.head.appendChild(style);
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<PresenterPrintDocument slides={slides} />);

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

export const printPresenterSlides = async (slides: PresenterSlideData[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  const { cleanup, container } = mountPresenterPrintSlides(slides);
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
