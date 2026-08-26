import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProviderStore } from '../useProviderStore';

/**
 * A stand-in for y-websocket's provider, faithful on the points these tests are about: the
 * listeners it lets us register, `shouldConnect`, which is what its retry loop reads before
 * opening a socket again, and the close codes it treats as terminal — 4400-4499, where it
 * stops reconnecting on its own and emits `closed`.
 */
class FakeProvider {
  public shouldConnect = true;
  public synced = false;
  public connect = vi.fn(() => {
    this.shouldConnect = true;
  });
  public disconnect = vi.fn(() => {
    this.shouldConnect = false;
  });
  public destroy = vi.fn();
  public awareness = { destroy: vi.fn() };
  public doc = { destroy: vi.fn() };

  private listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  on(event: string, listener: (...args: unknown[]) => void) {
    (this.listeners[event] ??= []).push(listener);
  }

  emit(event: string, ...args: unknown[]) {
    this.listeners[event]?.forEach((listener) => listener(...args));
  }

  /**
   * What y-websocket does on a close, in the same order: `connection-close` first, then —
   * for a code its default `shouldReconnect` calls permanent — `shouldConnect = false` and
   * `closed`.
   */
  close(code: number | null) {
    const event = code === null ? null : { code, reason: '' };
    this.emit('connection-close', event, this);

    if (event && event.code >= 4400 && event.code < 4500) {
      this.shouldConnect = false;
      this.emit('closed', event, this);
    }
  }
}

/**
 * A stand-in for `HttpProvider`. The store never drives its polling — that is
 * `createWebsocketFallback`'s job — so what matters here is that the store stops it when it
 * must, and that its `sync` reaches `isSynced`.
 */
class FakeHttpProvider {
  public shouldConnect = false;
  public synced = false;
  public connect = vi.fn(() => {
    this.shouldConnect = true;
  });
  public disconnect = vi.fn(() => {
    this.shouldConnect = false;
  });
  public destroy = vi.fn();

  private listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  on(event: string, listener: (...args: unknown[]) => void) {
    (this.listeners[event] ??= []).push(listener);
  }

  emit(event: string, ...args: unknown[]) {
    this.listeners[event]?.forEach((listener) => listener(...args));
  }
}

let provider: FakeProvider;
let httpProvider: FakeHttpProvider;
let stopFallback: ReturnType<typeof vi.fn>;

vi.mock('y-websocket', () => ({
  // a function expression, not an arrow: the store builds it with `new`
  WebsocketProvider: vi.fn(function () {
    return provider;
  }),
}));

/**
 * Stands in for `createWebsocketFallback`, emulating the one reaction the store has to order
 * itself against: on `closed` the real helper starts the http provider, so the store's own
 * `closed` handler has to run after it — lib0 emits to a snapshot of its listeners, so the
 * `off()` inside one does not stop the ones registered after it.
 */
const createWebsocketFallback = vi.fn(
  (primary: FakeProvider, secondary: FakeHttpProvider) => {
    const onClosed = () => secondary.connect();
    primary.on('closed', onClosed);
    return stopFallback;
  },
);

vi.mock('@y/yhub-http-fallback', () => ({
  HttpProvider: vi.fn(function () {
    return httpProvider;
  }),
  createWebsocketFallback: (primary: unknown, secondary: unknown) =>
    createWebsocketFallback(
      primary as FakeProvider,
      secondary as FakeHttpProvider,
    ),
}));

const closeWith = (code: number) => provider.close(code);

describe('useProviderStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    provider = new FakeProvider();
    httpProvider = new FakeHttpProvider();
    stopFallback = vi.fn();
    createWebsocketFallback.mockClear();
    // the store is a module-level singleton: put it back to its defaults, or
    // a test reads what the one before it left behind
    useProviderStore.getState().destroyProvider();
    createWebsocketFallback.mockClear();
    useProviderStore
      .getState()
      .createProvider('ws://localhost/collaboration/ws/v1/docs', 'doc-id');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps reconnecting when the connection is merely lost', () => {
    closeWith(1006);
    vi.runAllTimers();

    // y-websocket has scheduled its next attempt and nothing stops it
    expect(provider.shouldConnect).toBe(true);
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(false);
    // the document is refetched: the connection may have dropped because the
    // access to it changed
    expect(useProviderStore.getState().hasLostConnection).toBe(true);
    // and the http fallback is left in place to take over
    expect(stopFallback).not.toHaveBeenCalled();
  });

  it.each([
    ['a deleted document', 4404],
    ['a revoked access', 4401],
  ])('stops reconnecting on %s', (_label, code) => {
    closeWith(code);

    // nothing polls a document that has just been refused, and nothing revives
    // the socket on a timer either
    expect(stopFallback).toHaveBeenCalled();
    expect(httpProvider.disconnect).toHaveBeenCalled();
    // and it stays that way: the fallback also reacts to `closed`, so this only
    // holds while the store has the last word on the event
    expect(httpProvider.shouldConnect).toBe(false);

    vi.runAllTimers();

    // the backend is asked what became of the document, through this rather
    // than through `hasLostConnection`: it decides whether to come back
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(true);
    expect(useProviderStore.getState().hasLostConnection).toBe(false);
    expect(useProviderStore.getState().isConnected).toBe(false);
  });

  it('keeps reconnecting on a transient error of the collaboration server', () => {
    // 4500-4599 is its transient range, 1013 is "try again later"
    closeWith(4503);
    vi.runAllTimers();

    expect(provider.shouldConnect).toBe(true);
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(false);
    expect(stopFallback).not.toHaveBeenCalled();
  });

  it('does not report a close it triggered itself as permanent', () => {
    // `destroy()` and `disconnect()` emit the event with no close event
    provider.close(null);
    vi.runAllTimers();

    expect(useProviderStore.getState().isPermanentlyClosed).toBe(false);
  });

  it('reopens the connection when the document is still there', () => {
    closeWith(4404);
    vi.runAllTimers();

    useProviderStore.getState().reconnect();

    expect(provider.connect).toHaveBeenCalled();
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(false);
    // the fallback comes back with it - one install at createProvider, one here
    expect(createWebsocketFallback).toHaveBeenCalledTimes(2);
  });

  it('leaves a connection refused for good closed when the tab becomes active', () => {
    closeWith(4404);
    vi.runAllTimers();

    useProviderStore.getState().pauseForInactivity();
    useProviderStore.getState().resumeFromInactivity();

    expect(provider.connect).not.toHaveBeenCalled();
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(true);
  });

  it('runs the http fallback on the same document and awareness', () => {
    expect(createWebsocketFallback).toHaveBeenCalledTimes(1);
    expect(createWebsocketFallback).toHaveBeenCalledWith(
      provider,
      httpProvider,
    );
    expect(useProviderStore.getState().httpProvider).toBe(httpProvider);
  });

  it('reports the document as synced while it is the http fallback that syncs it', () => {
    closeWith(1006);
    expect(useProviderStore.getState().isSynced).toBe(false);

    httpProvider.synced = true;
    httpProvider.emit('sync', true);

    // `useUpdateDoc` reads this to tell the backend that the collaboration
    // server holds the content - true of either transport
    expect(useProviderStore.getState().isSynced).toBe(true);
  });

  it('tears everything down with the document', () => {
    useProviderStore.getState().destroyProvider();

    expect(stopFallback).toHaveBeenCalled();
    expect(httpProvider.destroy).toHaveBeenCalled();
    expect(provider.destroy).toHaveBeenCalled();
    expect(provider.awareness.destroy).toHaveBeenCalled();
    expect(provider.doc.destroy).toHaveBeenCalled();
    expect(useProviderStore.getState().httpProvider).toBeUndefined();
  });
});
