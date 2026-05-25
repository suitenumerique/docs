import {
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  DESIGN_WIDTH,
  FIT_DECIMALS,
  FIT_EPSILON,
  FIT_MARGIN,
  S_MAX,
  S_MIN,
} from '../constants';

interface UseFitScaleOptions {
  designWidth?: number;
  minScale?: number;
  maxScale?: number;
  /** Bumped when the slide frame viewport changes (e.g. fullscreen toggle). */
  viewportEpoch?: boolean;
}

/** Delays for remeasure after viewport transitions (fullscreen lags layout). */
const VIEWPORT_REMEASURE_DELAYS_MS = [0, 50, 150, 300, 500] as const;

export const scheduleFitScaleBurst = (run: () => void): (() => void) => {
  run();
  let rafId1 = 0;
  let rafId2 = 0;
  if (typeof requestAnimationFrame !== 'undefined') {
    rafId1 = requestAnimationFrame(() => {
      run();
      rafId2 = requestAnimationFrame(run);
    });
  }
  const timeouts = VIEWPORT_REMEASURE_DELAYS_MS.map((ms) =>
    window.setTimeout(run, ms),
  );
  return () => {
    if (rafId1) {
      cancelAnimationFrame(rafId1);
    }
    if (rafId2) {
      cancelAnimationFrame(rafId2);
    }
    timeouts.forEach((id) => window.clearTimeout(id));
  };
};

export interface FitScaleResult {
  scale: number;
  naturalHeight: number;
  remeasure: () => void;
}

const snap = (value: number) => {
  const factor = 10 ** FIT_DECIMALS;
  return Math.round(value * factor) / factor;
};

/**
 * Content height for scale fitting. Returns 0 until ProseMirror is in the
 * DOM so callers defer the first fit until BlockNote has mounted — the card's
 * own offsetHeight can be polluted by inherited flex layout before then,
 * locking the computed scale at a wrong value.
 */
export const measureCardNaturalHeight = (card: HTMLElement): number => {
  const prose = card.querySelector<HTMLElement>('.ProseMirror');
  if (!prose) {
    return 0;
  }
  const contentH = prose.scrollHeight || prose.offsetHeight;
  if (contentH <= 0) {
    return 0;
  }
  const style = getComputedStyle(card);
  const padY =
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0);
  return contentH + padY;
};

/**
 * Computes a uniform `transform: scale()` factor that fits a fixed-width
 * design canvas inside `frameRef`. The card mounted at `cardRef` must
 * already have `width: designWidth` and `transform: scale(<returned scale>)`
 * applied with `transform-origin: top left`. Because `transform` does not
 * affect layout, the measured natural height is taken from the editor content
 * (`.ProseMirror`) plus card padding when available.
 *
 * Returns { scale, naturalHeight, remeasure } so the caller can size a wrapper
 * at the post-scale dimensions (designWidth * scale × naturalHeight * scale).
 */
export const useFitScale = (
  frameRef: RefObject<HTMLElement | null>,
  cardRef: RefObject<HTMLElement | null>,
  {
    designWidth = DESIGN_WIDTH,
    minScale = S_MIN,
    maxScale = S_MAX,
    viewportEpoch,
  }: UseFitScaleOptions = {},
): FitScaleResult => {
  const [state, setState] = useState({
    scale: 1,
    naturalHeight: 0,
  });
  const stateRef = useRef(state);
  const lastFrameSizeRef = useRef({ w: 0, h: 0 });
  const recomputeRef = useRef<(() => void) | null>(null);

  const remeasure = useCallback(() => {
    recomputeRef.current?.();
  }, []);

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const frame = frameRef.current;
    const card = cardRef.current;
    if (!frame || !card) {
      return;
    }

    const recompute = () => {
      const fW = frame.clientWidth;
      const fH = frame.clientHeight;
      if (fW === 0 || fH === 0) {
        return;
      }
      const naturalH = measureCardNaturalHeight(card);
      if (naturalH === 0) {
        return;
      }
      const sFitW = fW / designWidth;
      const sFitH = (fH * FIT_MARGIN) / naturalH;
      const raw = Math.min(maxScale, sFitW, sFitH);
      const nextScale = snap(Math.max(minScale, raw));
      const prev = stateRef.current;
      const frameChanged =
        Math.abs(fW - lastFrameSizeRef.current.w) > 2 ||
        Math.abs(fH - lastFrameSizeRef.current.h) > 2;
      lastFrameSizeRef.current = { w: fW, h: fH };
      if (
        !frameChanged &&
        Math.abs(nextScale - prev.scale) < FIT_EPSILON &&
        naturalH === prev.naturalHeight
      ) {
        return;
      }
      const next = { scale: nextScale, naturalHeight: naturalH };
      stateRef.current = next;
      setState(next);
    };

    recomputeRef.current = recompute;

    const observer = new ResizeObserver(recompute);
    observer.observe(frame);
    observer.observe(card);

    const watched = new WeakSet<HTMLImageElement>();
    const onImageLoad = () => recompute();
    const attachImageListeners = () => {
      card.querySelectorAll('img').forEach((img) => {
        if (watched.has(img) || img.complete) {
          return;
        }
        watched.add(img);
        img.addEventListener('load', onImageLoad, { once: true });
      });
    };

    const mutation =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            attachImageListeners();
            recompute();
          })
        : null;
    mutation?.observe(card, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    const onViewportChange = () => scheduleFitScaleBurst(recompute);
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onViewportChange);
      window.visualViewport?.addEventListener('resize', onViewportChange);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', onViewportChange);
    }

    attachImageListeners();
    recompute();

    let rafId1 = 0;
    let rafId2 = 0;
    if (typeof requestAnimationFrame !== 'undefined') {
      rafId1 = requestAnimationFrame(() => {
        recompute();
        rafId2 = requestAnimationFrame(recompute);
      });
    }

    // BlockNote/ProseMirror often mounts after the first layout pass.
    let pollCount = 0;
    const pollId = window.setInterval(() => {
      pollCount += 1;
      recompute();
      if (stateRef.current.naturalHeight > 0 || pollCount >= 40) {
        window.clearInterval(pollId);
      }
    }, 50);

    return () => {
      recomputeRef.current = null;
      window.clearInterval(pollId);
      if (rafId1) {
        cancelAnimationFrame(rafId1);
      }
      if (rafId2) {
        cancelAnimationFrame(rafId2);
      }
      observer.disconnect();
      mutation?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onViewportChange);
        window.visualViewport?.removeEventListener('resize', onViewportChange);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('fullscreenchange', onViewportChange);
      }
    };
  }, [frameRef, cardRef, designWidth, minScale, maxScale]);

  useEffect(() => {
    if (viewportEpoch === undefined) {
      return;
    }
    return scheduleFitScaleBurst(() => recomputeRef.current?.());
  }, [viewportEpoch]);

  return { ...state, remeasure };
};
