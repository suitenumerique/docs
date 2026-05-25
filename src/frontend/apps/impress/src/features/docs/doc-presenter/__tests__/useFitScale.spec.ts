import { act, renderHook } from '@testing-library/react';
import { RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { DESIGN_WIDTH, FIT_MARGIN, S_MAX, S_MIN } from '../constants';
import {
  measureCardNaturalHeight,
  scheduleFitScaleBurst,
  useFitScale,
} from '../hooks/useFitScale';

type ResizeCallback = () => void;

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  callback: ResizeCallback;
  observed: Element[] = [];

  constructor(cb: ResizeCallback) {
    this.callback = cb;
    MockResizeObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
  }

  unobserve(el: Element) {
    this.observed = this.observed.filter((e) => e !== el);
  }

  disconnect() {
    this.observed = [];
  }

  trigger() {
    this.callback();
  }

  static last() {
    return MockResizeObserver.instances[
      MockResizeObserver.instances.length - 1
    ];
  }

  static reset() {
    MockResizeObserver.instances = [];
  }
}

const snap3 = (n: number) => Math.round(n * 1000) / 1000;

const setFrameDims = (el: HTMLElement, width: number, height: number) => {
  Object.defineProperty(el, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: height,
  });
};

/**
 * Drives `measureCardNaturalHeight`. The hook treats a missing `.ProseMirror`
 * as "no measurable content yet" (returns 0), so passing 0 here removes the
 * child and any non-zero value attaches a ProseMirror with that scrollHeight
 * — the same shape BlockNote produces once it mounts.
 */
const setCardHeight = (el: HTMLElement, height: number) => {
  let prose = el.querySelector<HTMLElement>('.ProseMirror');
  if (height === 0) {
    if (prose) {
      prose.remove();
    }
    Object.defineProperty(el, 'offsetHeight', {
      configurable: true,
      value: 0,
    });
    return;
  }
  if (!prose) {
    prose = document.createElement('div');
    prose.className = 'ProseMirror';
    el.appendChild(prose);
  }
  Object.defineProperty(prose, 'scrollHeight', {
    configurable: true,
    value: height,
  });
  Object.defineProperty(el, 'offsetHeight', {
    configurable: true,
    value: height,
  });
};

describe('measureCardNaturalHeight', () => {
  test('uses ProseMirror scroll height plus card padding when present', () => {
    const card = document.createElement('div');
    card.style.paddingTop = '40px';
    card.style.paddingBottom = '40px';
    document.body.appendChild(card);

    const prose = document.createElement('div');
    prose.className = 'ProseMirror';
    Object.defineProperty(prose, 'scrollHeight', { value: 300 });
    card.appendChild(prose);

    expect(measureCardNaturalHeight(card)).toBe(380);

    document.body.removeChild(card);
  });

  test('returns 0 when ProseMirror is missing, regardless of card offsetHeight', () => {
    const card = document.createElement('div');
    Object.defineProperty(card, 'offsetHeight', {
      configurable: true,
      value: 420,
    });
    expect(measureCardNaturalHeight(card)).toBe(0);
  });

  test('returns 0 when ProseMirror is present but has no measured scrollHeight', () => {
    const card = document.createElement('div');
    const prose = document.createElement('div');
    prose.className = 'ProseMirror';
    Object.defineProperty(prose, 'scrollHeight', { value: 0 });
    card.appendChild(prose);
    expect(measureCardNaturalHeight(card)).toBe(0);
  });
});

describe('useFitScale', () => {
  let frame: HTMLDivElement;
  let card: HTMLDivElement;
  let frameRef: RefObject<HTMLDivElement | null>;
  let cardRef: RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    MockResizeObserver.reset();
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    frame = document.createElement('div');
    card = document.createElement('div');
    frameRef = { current: frame };
    cardRef = { current: card };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('caps at S_MAX when the frame is much wider than the design canvas and content is short', () => {
    setFrameDims(frame, DESIGN_WIDTH * (S_MAX + 1), 5000);
    setCardHeight(card, 400);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.scale).toBe(S_MAX);
    expect(result.current.naturalHeight).toBe(400);
  });

  test('fits to frame width when frame is narrower than design canvas at S_MAX', () => {
    setFrameDims(frame, 1000, 5000);
    setCardHeight(card, 400);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    const expected = snap3(1000 / DESIGN_WIDTH);
    expect(result.current.scale).toBe(expected);
  });

  test('shrinks below the width-fit when content is too tall', () => {
    setFrameDims(frame, 2000, 900);
    setCardHeight(card, 1000);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    const expected = snap3((900 * FIT_MARGIN) / 1000);
    expect(result.current.scale).toBe(expected);
  });

  test('floors at S_MIN when content is far too tall', () => {
    setFrameDims(frame, 1000, 400);
    setCardHeight(card, 5000);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.scale).toBe(S_MIN);
  });

  test('keeps the initial state when the frame is empty', () => {
    setFrameDims(frame, 0, 0);
    setCardHeight(card, 400);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.scale).toBe(1);
    expect(result.current.naturalHeight).toBe(0);
  });

  test('keeps the initial state when the card has no measurable height', () => {
    setFrameDims(frame, 1000, 800);
    setCardHeight(card, 0);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.scale).toBe(1);
    expect(result.current.naturalHeight).toBe(0);
  });

  test('ignores card offsetHeight before ProseMirror mounts (initial-mount race)', () => {
    // Repro of the presenter-mode init bug: on first useLayoutEffect, BlockNote
    // has not yet inserted .ProseMirror. The card's offsetHeight is polluted
    // by the surrounding flex layout (≈ frame.height * 0.95), which would
    // snap the scale near 1 if used as the natural height. Once ProseMirror
    // appears, the scale should jump to S_MAX.
    setFrameDims(frame, 1440, 900);
    Object.defineProperty(card, 'offsetHeight', {
      configurable: true,
      value: Math.round(900 * 0.95),
    });

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.scale).toBe(1);
    expect(result.current.naturalHeight).toBe(0);

    act(() => {
      setCardHeight(card, 400);
      MockResizeObserver.last().trigger();
    });
    expect(result.current.naturalHeight).toBe(400);
    expect(result.current.scale).toBe(S_MAX);
  });

  test('remeasure updates scale when the card gains height', () => {
    setFrameDims(frame, 1000, 800);
    setCardHeight(card, 0);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.naturalHeight).toBe(0);

    act(() => {
      setCardHeight(card, 400);
      result.current.remeasure();
    });
    expect(result.current.naturalHeight).toBe(400);
    expect(result.current.scale).toBeGreaterThan(0);
  });

  test('recomputes when ResizeObserver fires with valid dimensions', () => {
    setFrameDims(frame, 1000, 800);
    setCardHeight(card, 0);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.naturalHeight).toBe(0);

    act(() => {
      setCardHeight(card, 500);
      MockResizeObserver.last().trigger();
    });
    expect(result.current.naturalHeight).toBe(500);
  });

  test('schedules a double requestAnimationFrame recompute on mount', () => {
    const rafSpy = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', rafSpy);

    setFrameDims(frame, 1200, 1000);
    setCardHeight(card, 600);

    renderHook(() => useFitScale(frameRef, cardRef));

    expect(rafSpy).toHaveBeenCalled();
  });

  test('recomputes when the frame is resized', () => {
    setFrameDims(frame, 1200, 1000);
    setCardHeight(card, 600);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    const wideExpected = Math.min(S_MAX, snap3(1200 / DESIGN_WIDTH));
    expect(result.current.scale).toBe(wideExpected);

    act(() => {
      setFrameDims(frame, 1200, 500);
      MockResizeObserver.last().trigger();
    });
    expect(result.current.scale).toBe(snap3((500 * FIT_MARGIN) / 600));
  });

  test('does not re-render when the scale change is below the epsilon', () => {
    setFrameDims(frame, 1200, 900);
    setCardHeight(card, 1000);

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useFitScale(frameRef, cardRef);
    });
    const settled = snap3((900 * FIT_MARGIN) / 1000);
    expect(result.current.scale).toBe(settled);
    const renderCountAfterStabilization = renderCount;

    act(() => {
      setFrameDims(frame, 1200, 901);
      MockResizeObserver.last().trigger();
    });
    expect(result.current.scale).toBe(settled);
    expect(renderCount).toBe(renderCountAfterStabilization);
  });

  test('reports the natural unscaled height regardless of the applied scale', () => {
    setFrameDims(frame, 1000, 500);
    setCardHeight(card, 1500);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.naturalHeight).toBe(1500);
    const expected = snap3(
      Math.max(S_MIN, Math.min(S_MAX, (500 * FIT_MARGIN) / 1500)),
    );
    expect(result.current.scale).toBe(expected);
  });

  test('recomputes on window resize even when ResizeObserver does not fire', () => {
    setFrameDims(frame, 1200, 1000);
    setCardHeight(card, 600);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.scale).toBe(
      Math.min(S_MAX, snap3(1200 / DESIGN_WIDTH)),
    );

    act(() => {
      setFrameDims(frame, 1200, 500);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.scale).toBe(snap3((500 * FIT_MARGIN) / 600));
  });

  test('recomputes on document fullscreenchange', () => {
    vi.useFakeTimers();
    setFrameDims(frame, 1200, 1000);
    setCardHeight(card, 600);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    expect(result.current.scale).toBe(
      Math.min(S_MAX, snap3(1200 / DESIGN_WIDTH)),
    );

    act(() => {
      setFrameDims(frame, 1200, 500);
      document.dispatchEvent(new Event('fullscreenchange'));
      vi.runAllTimers();
    });
    expect(result.current.scale).toBe(snap3((500 * FIT_MARGIN) / 600));
    vi.useRealTimers();
  });

  test('recomputes when viewportEpoch changes (fullscreen toggle)', () => {
    vi.useFakeTimers();
    setFrameDims(frame, 1000, 800);
    setCardHeight(card, 400);

    const { result, rerender } = renderHook(
      ({ fs }: { fs: boolean }) =>
        useFitScale(frameRef, cardRef, { viewportEpoch: fs }),
      { initialProps: { fs: false } },
    );
    expect(result.current.scale).toBe(snap3(1000 / DESIGN_WIDTH));

    act(() => {
      setFrameDims(frame, 1600, 900);
      rerender({ fs: true });
      vi.runAllTimers();
    });
    expect(result.current.scale).toBe(
      Math.min(S_MAX, snap3(1600 / DESIGN_WIDTH)),
    );
    vi.useRealTimers();
  });

  test('forces a scale update when the frame size changes beyond epsilon', () => {
    setFrameDims(frame, 1200, 1000);
    setCardHeight(card, 600);

    const { result } = renderHook(() => useFitScale(frameRef, cardRef));
    const initialScale = result.current.scale;

    act(() => {
      setFrameDims(frame, 1600, 1000);
      MockResizeObserver.last().trigger();
    });
    expect(result.current.scale).toBeGreaterThan(initialScale);
  });
});

describe('scheduleFitScaleBurst', () => {
  test('invokes the callback immediately and on delayed timers', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const cleanup = scheduleFitScaleBurst(run);
    expect(run).toHaveBeenCalledTimes(1);
    act(() => {
      vi.runAllTimers();
    });
    expect(run.mock.calls.length).toBeGreaterThan(3);
    cleanup();
    vi.useRealTimers();
  });
});
