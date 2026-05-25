/**
 * Half-window of slide renderers mounted around the current slide.
 * Total mounted = 2 * PRESENTER_WINDOW_RADIUS + 1.
 * 1 = three slides mounted (prev, current, next) — sweet spot between
 * memory and navigation flash. Tune freely.
 */
export const PRESENTER_WINDOW_RADIUS = 1;

/**
 * Natural (unscaled) width of a slide's design canvas, in CSS pixels.
 * Stays constant; the visual width is `DESIGN_WIDTH * scale` and changes
 * only via the scale factor — same approach as Notion's slide rendering.
 */
export const DESIGN_WIDTH = 960;
/** Largest scale applied when the frame is much wider than the design canvas. */
export const S_MAX = 1.3;
/** Smallest scale before we stop shrinking and let the frame scroll instead. */
export const S_MIN = 0.7;
/**
 * Vertical breathing-room factor applied to the height-fit budget. The
 * horizontal axis fills up to `S_MAX` without margin so the card hugs the
 * frame width when it can.
 */
export const FIT_MARGIN = 0.95;
/** Minimum scale delta required before re-rendering with a new value. */
export const FIT_EPSILON = 0.005;
/** Snap precision for the computed scale, keeps the RO loop convergent. */
export const FIT_DECIMALS = 3;
