import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProviderStore } from '../useProviderStore';

/**
 * A stand-in for y-websocket's provider, faithful on the two points these
 * tests are about: the listeners it lets us register, and `shouldConnect`,
 * which is what its retry loop reads before opening a socket again.
 */
class FakeProvider {
  public shouldConnect = true;
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
}

let provider: FakeProvider;

vi.mock('y-websocket', () => ({
  // a function expression, not an arrow: the store builds it with `new`
  WebsocketProvider: vi.fn(function () {
    return provider;
  }),
}));

const closeWith = (code: number) =>
  provider.emit('connection-close', { code }, provider);

describe('useProviderStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    provider = new FakeProvider();
    // the store is a module-level singleton: put it back to its defaults, or
    // a test reads what the one before it left behind
    useProviderStore.getState().destroyProvider();
    useProviderStore.getState().createProvider('ws://localhost', 'doc-id');
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
  });

  it.each([
    ['a deleted document', 4404],
    ['a revoked access', 4401],
  ])('stops reconnecting on %s', (_label, code) => {
    closeWith(code);

    // immediately, before the reconnection y-websocket has just scheduled
    expect(provider.shouldConnect).toBe(false);

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
  });

  it('does not report a close it triggered itself as permanent', () => {
    // `destroy()` and `disconnect()` emit the event with no close event
    provider.emit('connection-close', null, provider);
    vi.runAllTimers();

    expect(useProviderStore.getState().isPermanentlyClosed).toBe(false);
  });

  it('reopens the connection when the document is still there', () => {
    closeWith(4404);
    vi.runAllTimers();

    useProviderStore.getState().reconnect();

    expect(provider.connect).toHaveBeenCalled();
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(false);
  });

  it('leaves a connection refused for good closed when the tab becomes active', () => {
    closeWith(4404);
    vi.runAllTimers();

    useProviderStore.getState().pauseForInactivity();
    useProviderStore.getState().resumeFromInactivity();

    expect(provider.connect).not.toHaveBeenCalled();
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(true);
  });
});
