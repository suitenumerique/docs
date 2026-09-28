import { act, renderHook } from '@testing-library/react';
import { RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { computeFitScale, useFitScale } from '../hooks/useFitScale';

// Live constants the pure function closes over (see constants.ts):
// designWidth=900, minScale=0.7, maxScale=1.5, paddingX=64, paddingY=64.
// So availW = frameWidth - 128 and availH = frameHeight - 128.
describe('computeFitScale', () => {
  // Short content: scaleW/scaleH both large, clamped down to MAX.
  test('short content clamps to MAX scale', () => {
    // availW=1792, availH=952; scaleW=1.99, scaleH=4.76 -> min 1.99 -> clamp 1.5
    const fit = computeFitScale(200, 1920, 1080);
    expect(fit).not.toBeNull();
    expect(fit?.scale).toBeCloseTo(1.5, 5);
    expect(fit?.outerWidth).toBeCloseTo(900 * 1.5, 5);
    expect(fit?.stageHeight).toBeCloseTo(300, 5);
  });

  // Tall content: scaleH tiny, clamped up to MIN. The slide then overflows and
  // scrolls — handled purely in CSS (PresenterSlide's outer is
  // overflow-y:auto, the stage uses margin:auto so the top is never clipped).
  test('tall content floors at MIN scale', () => {
    // availH=952, naturalH=3000 -> scaleH=0.317 -> clamp 0.7; 3000 × 0.7 = 2100
    const fit = computeFitScale(3000, 1920, 1080);
    expect(fit?.scale).toBeCloseTo(0.7, 5);
    expect(fit?.stageHeight).toBeCloseTo(2100, 5);
  });

  // Height-limited exact fit: naturalH equals availH, scaleH=1.0 wins.
  test('content that exactly fits picks scaleH', () => {
    // availH=952, naturalH=952 -> scaleH=1.0, scaleW=1.99 -> min 1.0
    const fit = computeFitScale(952, 1920, 1080);
    expect(fit?.scale).toBeCloseTo(1.0, 5);
    expect(fit?.stageHeight).toBeCloseTo(952, 5);
  });

  test('width-limited frame below MIN clamps up to MIN', () => {
    // availW=572 -> scaleW=0.635 < 0.7 -> clamp up to 0.7
    const fit = computeFitScale(400, 700, 1080);
    expect(fit?.scale).toBeCloseTo(0.7, 5);
  });

  test('width-limited frame within range picks scaleW', () => {
    // availW=872 -> scaleW=872/900=0.969; availH=1372 -> scaleH=3.43 -> min 0.969
    const fit = computeFitScale(400, 1000, 1500);
    expect(fit?.scale).toBeCloseTo(872 / 900, 5);
  });

  test('returns null on non-positive dimensions', () => {
    expect(computeFitScale(0, 1920, 1080)).toBeNull(); // no content height yet
    expect(computeFitScale(500, 100, 1080)).toBeNull(); // availW = 100 - 128 <= 0
    expect(computeFitScale(500, 1920, 100)).toBeNull(); // availH = 100 - 128 <= 0
  });
});

type Callback = ResizeObserverCallback;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: Callback;
  targets: Element[] = [];

  constructor(callback: Callback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(target: Element): void {
    this.targets = this.targets.filter((t) => t !== target);
  }

  disconnect(): void {
    this.targets = [];
  }

  trigger(): void {
    this.callback([], this);
  }
}

const triggerAll = () => {
  for (const o of FakeResizeObserver.instances) {
    o.trigger();
  }
};

const makeRefs = (
  innerScrollHeight: number,
  frameClientWidth: number,
  frameClientHeight: number,
) => {
  const inner = document.createElement('div');
  const frame = document.createElement('div');
  Object.defineProperty(inner, 'scrollHeight', {
    configurable: true,
    get: () => innerScrollHeight,
  });
  Object.defineProperty(frame, 'clientWidth', {
    configurable: true,
    get: () => frameClientWidth,
  });
  Object.defineProperty(frame, 'clientHeight', {
    configurable: true,
    get: () => frameClientHeight,
  });
  document.body.appendChild(inner);
  document.body.appendChild(frame);
  return {
    inner,
    frame,
    innerRef: { current: inner } as RefObject<HTMLDivElement | null>,
    frameRef: { current: frame } as RefObject<HTMLDivElement | null>,
    setInnerScrollHeight: (h: number) => {
      Object.defineProperty(inner, 'scrollHeight', {
        configurable: true,
        get: () => h,
      });
    },
    setFrameSize: (w: number, h: number) => {
      Object.defineProperty(frame, 'clientWidth', {
        configurable: true,
        get: () => w,
      });
      Object.defineProperty(frame, 'clientHeight', {
        configurable: true,
        get: () => h,
      });
    },
  };
};

// Thin glue tests: the formula is covered above, so these only assert the
// wiring (initial measure, re-measure on either resize, SSR safety, cleanup).
// No rAF: measure() runs synchronously inside the effect and the observer
// callback, so there is nothing async to flush.
describe('useFitScale', () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  test('measures synchronously on mount', () => {
    const refs = makeRefs(500, 1920, 1080);
    const { result } = renderHook(() =>
      useFitScale(refs.innerRef, refs.frameRef),
    );

    expect(result.current).not.toBeNull();
    expect(result.current?.scale).toBeCloseTo(
      computeFitScale(500, 1920, 1080)!.scale,
      5,
    );
  });

  test('frame resize triggers a new computation', () => {
    const refs = makeRefs(500, 1920, 1080);
    const { result } = renderHook(() =>
      useFitScale(refs.innerRef, refs.frameRef),
    );

    const initialScale = result.current?.scale;
    expect(initialScale).not.toBeUndefined();

    refs.setFrameSize(1280, 720);
    act(() => triggerAll());

    expect(result.current?.scale).not.toBe(initialScale);
  });

  test('inner resize (content grew) triggers a new computation', () => {
    const refs = makeRefs(500, 1920, 1080);
    const { result } = renderHook(() =>
      useFitScale(refs.innerRef, refs.frameRef),
    );

    const initialScale = result.current?.scale;

    refs.setInnerScrollHeight(2500);
    act(() => triggerAll());

    expect(result.current?.scale).not.toBe(initialScale);
    expect(result.current?.scale).toBeCloseTo(0.7, 5);
  });

  test('stays null and does not throw without ResizeObserver (SSR)', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const refs = makeRefs(500, 1920, 1080);
    const { result } = renderHook(() =>
      useFitScale(refs.innerRef, refs.frameRef),
    );

    expect(result.current).toBeNull();
  });

  test('cleanup on unmount disconnects observers', () => {
    const refs = makeRefs(500, 1920, 1080);
    const { unmount } = renderHook(() =>
      useFitScale(refs.innerRef, refs.frameRef),
    );

    expect(FakeResizeObserver.instances).toHaveLength(1);
    const observer = FakeResizeObserver.instances[0];
    expect(observer.targets).toHaveLength(2);

    unmount();

    expect(observer.targets).toHaveLength(0);
  });
});
