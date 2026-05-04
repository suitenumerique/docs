/**
 * Half-window of slide renderers mounted around the current slide.
 * Total mounted = 2 * PRESENTER_WINDOW_RADIUS + 1.
 * 1 = three slides mounted (prev, current, next) — sweet spot between
 * memory and navigation flash. Tune freely.
 */
export const PRESENTER_WINDOW_RADIUS = 1;
