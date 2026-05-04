import { RefObject, useEffect, useState } from 'react';

import {
  PRESENTER_FRAME_PADDING_X,
  PRESENTER_FRAME_PADDING_Y,
  PRESENTER_SLIDE_DESIGN_WIDTH,
  PRESENTER_SLIDE_MAX_SCALE,
  PRESENTER_SLIDE_MIN_SCALE,
} from '../constants';

/**
 * Dimensions of a slide scaled to fit its frame. `null` until measured —
 * render the slide at opacity 0 until then to avoid a scale-jump on first
 * paint.
 */
export interface FitScale {
  /** Clamped scale factor to apply via `transform: scale(...)`. */
  scale: number;
  /** Visible width of the scaled slide (`designWidth × scale`). */
  outerWidth: number;
  /** Painted height of the scaled inner content (`naturalHeight × scale`). */
  stageHeight: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Pure scaling formula, extracted so it can be unit-tested without the DOM.
 * `naturalHeight` is the inner's un-transformed `scrollHeight`; `frameWidth`/
 * `frameHeight` are the frame's client box. Honours the more constraining axis
 * (`min(scaleW, scaleH)`) then clamps into `[MIN, MAX]`: below MIN the slide
 * scrolls (pure CSS), above MAX sparse slides are capped. Returns `null` for
 * non-positive inputs (transient zero sizes during mount).
 *
 * `transform: scale(...)` does not affect layout boxes, so reading
 * `naturalHeight` off the same element the consumer scales is safe.
 */
export const computeFitScale = (
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
): FitScale | null => {
  const availW = frameWidth - 2 * PRESENTER_FRAME_PADDING_X;
  const availH = frameHeight - 2 * PRESENTER_FRAME_PADDING_Y;
  if (naturalHeight <= 0 || availW <= 0 || availH <= 0) {
    return null;
  }

  const scale = clamp(
    Math.min(availW / PRESENTER_SLIDE_DESIGN_WIDTH, availH / naturalHeight),
    PRESENTER_SLIDE_MIN_SCALE,
    PRESENTER_SLIDE_MAX_SCALE,
  );

  return {
    scale,
    outerWidth: PRESENTER_SLIDE_DESIGN_WIDTH * scale,
    stageHeight: naturalHeight * scale,
  };
};

/**
 * Reactively fit a slide's content into the available frame. Returns the
 * scaled dimensions, or `null` until the first measurement. Re-measures
 * whenever `inner` (content height) or `frame` (available area) resizes —
 * viewport resize, fullscreen toggle, late image load, font swap.
 *
 * No rAF / re-render guard: committing only sets the outer width (the outer is
 * `position: absolute`, so it cannot resize the observed frame), the stage
 * height (the stage is not observed), and the inner's `transform` (ignored by
 * ResizeObserver, which reports the layout box). No committed value resizes an
 * observed element, so the observer cannot re-fire itself — there is no loop
 * to coalesce or debounce. (Trade-off: true sub-pixel oscillation of the
 * observed boxes would cause a few cheap re-renders rather than being swallowed
 * — acceptable, and not worth a guard.)
 *
 * SSR-safe: DOM/ResizeObserver are touched only inside the effect.
 *
 * `inner` must be rendered at `PRESENTER_SLIDE_DESIGN_WIDTH` with no transform
 * during measurement.
 */
export const useFitScale = (
  innerRef: RefObject<HTMLDivElement | null>,
  frameRef: RefObject<HTMLDivElement | null>,
): FitScale | null => {
  const [fit, setFit] = useState<FitScale | null>(null);

  useEffect(() => {
    const inner = innerRef.current;
    const frame = frameRef.current;
    if (!inner || !frame || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const measure = () => {
      setFit(
        computeFitScale(
          inner.scrollHeight,
          frame.clientWidth,
          frame.clientHeight,
        ),
      );
    };

    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    observer.observe(frame);
    // Measure synchronously for a flicker-free first paint instead of waiting
    // for the observer's initial (async) callback.
    measure();

    return () => observer.disconnect();
  }, [innerRef, frameRef]);

  return fit;
};
