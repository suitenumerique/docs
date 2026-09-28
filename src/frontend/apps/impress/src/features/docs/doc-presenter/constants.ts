/**
 * Half-window of slide renderers mounted around the current slide.
 * Total mounted = 2 * PRESENTER_WINDOW_RADIUS + 1.
 * 1 = three slides mounted (prev, current, next) — sweet spot between
 * memory and navigation flash. Tune freely.
 */
export const PRESENTER_WINDOW_RADIUS = 1;

/**
 * Intrinsic design width of slide content, in CSS pixels. The slide's
 * inner wrapper renders at this exact width then `transform: scale(...)`
 * fits it into the available viewport.
 */
export const PRESENTER_SLIDE_DESIGN_WIDTH = 900;

/**
 * Lower bound of the per-slide scale. Below this, vertical scroll kicks
 * in instead of further shrinking the content.
 */
export const PRESENTER_SLIDE_MIN_SCALE = 0.7;

/**
 * Upper bound of the per-slide scale. Prevents sparse slides from
 * ballooning to an unreadable cinematic size.
 */
export const PRESENTER_SLIDE_MAX_SCALE = 1.5;

/**
 * Horizontal breathing room around the active slide, subtracted from
 * the frame's clientWidth before computing the width-based scale.
 */
export const PRESENTER_FRAME_PADDING_X = 64;

/**
 * Vertical breathing room around the active slide. Also leaves clearance
 * for the floating action bar.
 */
export const PRESENTER_FRAME_PADDING_Y = 64;

/**
 * Duration of the cross-fade between slides AND of the first-frame
 * fade-in, in milliseconds.
 */
export const PRESENTER_SLIDE_FADE_MS = 100;
