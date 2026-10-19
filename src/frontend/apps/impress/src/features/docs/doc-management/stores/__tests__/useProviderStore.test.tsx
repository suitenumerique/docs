import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

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

  /**
   * What `HttpProvider` does when a round fails with a client error other than 429: it stops
   * by clearing `shouldConnect`, then emits `closed` with the http status as the code.
   */
  giveUp(code: number) {
    this.shouldConnect = false;
    this.emit('closed', { code, reason: '' }, this);
  }
}

/**
 * A stand-in for `IndexeddbPersistence`. What the store asks of it is that it exists, that its
 * `synced` reaches `isReady` - local content is enough to render an editor - and that it is
 * detached with the document.
 */
class FakePersistence {
  public destroy = vi.fn().mockResolvedValue(undefined);

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
let persistence: FakePersistence;
let stopFallback: ReturnType<typeof vi.fn>;

vi.mock('y-websocket', () => ({
  // a function expression, not an arrow: the store builds it with `new`
  WebsocketProvider: vi.fn(function () {
    return provider;
  }),
}));

const { IndexeddbPersistenceMock } = vi.hoisted(() => ({
  IndexeddbPersistenceMock: vi.fn(function (..._args: unknown[]) {
    return undefined as never;
  }),
}));

vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: IndexeddbPersistenceMock,
  clearDocument: vi.fn().mockResolvedValue(undefined),
}));

// its own IndexedDB plumbing is exercised in localDocs.test — here we only
// check that opening a document records it
const { rememberLocalDocMock } = vi.hoisted(() => ({
  rememberLocalDocMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../localDocs', () => ({
  rememberLocalDoc: rememberLocalDocMock,
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

// hoisted alongside the `vi.mock` below, which is lifted above every `const` in
// this file — the store builds it with `new`, so it stays a function expression
const { HttpProviderMock } = vi.hoisted(() => ({
  HttpProviderMock: vi.fn(function (..._args: unknown[]) {
    return httpProvider;
  }),
}));

vi.mock('@y/yhub-http-fallback', () => ({
  HttpProvider: HttpProviderMock,
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
    persistence = new FakePersistence();
    stopFallback = vi.fn();
    // jsdom has none, and the store treats its absence as "no local copy"
    vi.stubGlobal('indexedDB', {});
    IndexeddbPersistenceMock.mockClear();
    IndexeddbPersistenceMock.mockImplementation(function () {
      return persistence as never;
    });
    rememberLocalDocMock.mockClear();
    createWebsocketFallback.mockClear();
    HttpProviderMock.mockClear();
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
    vi.unstubAllGlobals();
  });

  it('keeps reconnecting when the connection is merely lost', () => {
    // the socket had opened before it dropped
    provider.emit('status', { status: 'connected' });
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

  it('does not refetch the document while a socket that never opened retries', () => {
    // a network that blocks websocket upgrades: the socket never connects, and
    // `connection-close` fires on every failed attempt
    closeWith(1006);
    closeWith(1006);
    vi.runAllTimers();

    expect(provider.shouldConnect).toBe(true);
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(false);
    // no refetch storm on the retry cadence — the http fallback carries the doc
    expect(useProviderStore.getState().hasLostConnection).toBe(false);
    expect(stopFallback).not.toHaveBeenCalled();
  });

  it('does not re-render subscribers of the store on a repeat retry that changes nothing', () => {
    // components that read the store without a selector (most of them, here) get a new
    // object on every `set()` — even a same-value one — so a redundant `set()` on this
    // retry loop would flicker every one of them, forever
    closeWith(1006);
    const listener = vi.fn();
    useProviderStore.subscribe(listener);

    closeWith(1006);

    expect(listener).not.toHaveBeenCalled();
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

  it.each([
    ['a revoked or downgraded access', 403],
    ['an expired session', 401],
    ['a deleted document', 404],
  ])(
    'stops for good when the http fallback is refused on %s',
    (_label, code) => {
      // a network that blocks websockets: the fallback carries the document
      closeWith(1006);
      httpProvider.connect();

      httpProvider.giveUp(code);

      // the helper would otherwise revive the fallback every 30s, and it would be
      // refused again on every round, for as long as the tab stays open
      expect(stopFallback).toHaveBeenCalled();
      expect(httpProvider.shouldConnect).toBe(false);
      // and the socket stops asking the same question too
      expect(provider.disconnect).toHaveBeenCalled();
      expect(provider.shouldConnect).toBe(false);

      vi.runAllTimers();

      // the backend is asked what became of the document and of our access
      expect(useProviderStore.getState().isPermanentlyClosed).toBe(true);
      expect(useProviderStore.getState().hasLostConnection).toBe(false);
    },
  );

  it('reopens both transports after the http fallback was refused', () => {
    httpProvider.giveUp(403);
    vi.runAllTimers();

    useProviderStore.getState().reconnect();

    expect(provider.connect).toHaveBeenCalled();
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(false);
    expect(createWebsocketFallback).toHaveBeenCalledTimes(2);
  });

  it('leaves another client error of the http fallback to its own retry', () => {
    // a refetch of the document cannot settle a malformed or oversized request:
    // reconnecting would only reproduce it
    httpProvider.giveUp(413);
    vi.runAllTimers();

    expect(stopFallback).not.toHaveBeenCalled();
    expect(provider.disconnect).not.toHaveBeenCalled();
    expect(useProviderStore.getState().isPermanentlyClosed).toBe(false);
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

  it('lets an editor publish presence over the http fallback', () => {
    // the shared Awareness instance: one client id, one set of clocks, whichever
    // transport is carrying it
    expect(HttpProviderMock).toHaveBeenCalledTimes(1);
    expect(HttpProviderMock.mock.calls[0][3]).toMatchObject({
      awareness: provider.awareness,
    });
  });

  it('leaves the http fallback on its default interval when none is configured', () => {
    expect(HttpProviderMock.mock.calls[0][3]).not.toHaveProperty(
      'syncInterval',
    );
  });

  it('polls the http fallback at the configured interval', () => {
    useProviderStore.getState().destroyProvider();
    HttpProviderMock.mockClear();

    useProviderStore
      .getState()
      .createProvider(
        'ws://localhost/collaboration/ws/v1/docs',
        'doc-id',
        undefined,
        { httpSyncInterval: 30000 },
      );

    // COLLABORATION_HTTP_FALLBACK_SYNC_INTERVAL: every poll is authorized against
    // the backend, so this is what an operator turns to lower that load
    expect(HttpProviderMock.mock.calls[0][3]).toMatchObject({
      syncInterval: 30000,
    });
  });

  it('gives an editor no awareness on the http fallback when it is turned off', () => {
    useProviderStore.getState().destroyProvider();
    HttpProviderMock.mockClear();

    useProviderStore
      .getState()
      .createProvider(
        'ws://localhost/collaboration/ws/v1/docs',
        'doc-id',
        undefined,
        { httpAwareness: false },
      );

    // COLLABORATION_HTTP_FALLBACK_AWARENESS_ENABLED: no presence round, so the
    // provider only sends when there are changes and polls at the configured pace
    expect(HttpProviderMock.mock.calls[0][3]).toMatchObject({
      awareness: null,
    });
  });

  it('never polls the http fallback faster than every 5 seconds', () => {
    useProviderStore.getState().destroyProvider();
    HttpProviderMock.mockClear();

    useProviderStore
      .getState()
      .createProvider(
        'ws://localhost/collaboration/ws/v1/docs',
        'doc-id',
        undefined,
        { httpSyncInterval: 100 },
      );

    expect(HttpProviderMock.mock.calls[0][3]).toMatchObject({
      syncInterval: 5000,
    });
  });

  it('gives a read-only document no awareness on the http fallback', () => {
    useProviderStore.getState().destroyProvider();
    HttpProviderMock.mockClear();

    useProviderStore
      .getState()
      .createProvider(
        'ws://localhost/collaboration/ws/v1/docs',
        'doc-id',
        undefined,
        {
          readOnly: true,
        },
      );

    /**
     * A reader may not publish presence, and the provider has no receive-only
     * setting. Left enabled, its first round would PATCH awareness, take a 403
     * from the collaboration server, and — a 4xx being permanent — close before
     * it ever issued a GET, leaving a reader whose websocket is blocked in front
     * of an empty document. `null` is what keeps the round to a plain poll.
     */
    expect(HttpProviderMock).toHaveBeenCalledTimes(1);
    expect(HttpProviderMock.mock.calls[0][3]).toMatchObject({
      awareness: null,
    });
  });

  it('tears everything down with the document', () => {
    useProviderStore.getState().destroyProvider();

    expect(stopFallback).toHaveBeenCalled();
    expect(httpProvider.destroy).toHaveBeenCalled();
    expect(provider.destroy).toHaveBeenCalled();
    expect(provider.awareness.destroy).toHaveBeenCalled();
    expect(provider.doc.destroy).toHaveBeenCalled();
    // detached before the document is, so the last updates are written
    expect(persistence.destroy).toHaveBeenCalled();
    expect(useProviderStore.getState().httpProvider).toBeUndefined();
    expect(useProviderStore.getState().persistence).toBeUndefined();
  });

  it('keeps a local copy of the document, under its own id', () => {
    expect(IndexeddbPersistenceMock).toHaveBeenCalledTimes(1);
    expect(IndexeddbPersistenceMock.mock.calls[0][0]).toBe('doc-id');
    expect(useProviderStore.getState().persistence).toBe(persistence);
  });

  it('renders as soon as the local copy is loaded, without waiting for a connection', () => {
    expect(useProviderStore.getState().isReady).toBe(false);

    // the document the store built, which the local copy loads into
    const doc = IndexeddbPersistenceMock.mock.calls[0][1] as Y.Doc;
    doc
      .getXmlFragment('document-store')
      .insert(0, [new Y.XmlElement('blockGroup')]);
    persistence.emit('synced');

    expect(useProviderStore.getState().isReady).toBe(true);
    // nothing was connected: this is the offline path
    expect(useProviderStore.getState().isConnected).toBe(false);
  });

  it('keeps loading when the local copy is empty, until the content is synced', () => {
    // a device that never opened this doc: rendering now would show the empty-doc placeholder
    persistence.emit('synced');
    provider.emit('status', { status: 'connected' });

    expect(useProviderStore.getState().isReady).toBe(false);

    provider.synced = true;
    provider.emit('sync', true);

    expect(useProviderStore.getState().isReady).toBe(true);
  });

  it('keeps loading when the socket fails on an empty copy, until the http fallback syncs', () => {
    // a network that blocks websocket upgrades, on a device that never opened this doc
    persistence.emit('synced');
    closeWith(1006);

    expect(useProviderStore.getState().isReady).toBe(false);

    httpProvider.synced = true;
    httpProvider.emit('sync', true);

    expect(useProviderStore.getState().isReady).toBe(true);
  });

  it('renders when the socket fails on a copy that has content', () => {
    const doc = IndexeddbPersistenceMock.mock.calls[0][1] as Y.Doc;
    doc
      .getXmlFragment('document-store')
      .insert(0, [new Y.XmlElement('blockGroup')]);
    closeWith(1006);

    expect(useProviderStore.getState().isReady).toBe(true);
  });

  it('remembers the document, so the sweep leaves its copy alone', () => {
    expect(rememberLocalDocMock).toHaveBeenCalledWith('doc-id');
  });

  it("drops a reader's http writes instead of letting the server refuse them", async () => {
    useProviderStore.getState().destroyProvider();
    HttpProviderMock.mockClear();
    const realFetch = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal('fetch', realFetch);

    useProviderStore
      .getState()
      .createProvider(
        'ws://localhost/collaboration/ws/v1/docs',
        'doc-id',
        undefined,
        {
          readOnly: true,
        },
      );

    const { fetch: providerFetch } = HttpProviderMock.mock.calls[0][3] as {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    };

    /**
     * A reader's PATCH would take a 403, and a 4xx stops the provider for good -
     * before its first GET, since the PATCH comes first in a round. The socket
     * drops a reader's updates and stays open; this makes http agree.
     */
    const patched = await providerFetch('http://collab/ydoc/v1/docs/doc-id', {
      method: 'PATCH',
    });

    expect(patched.status).toBe(204);
    expect(realFetch).not.toHaveBeenCalled();

    // reading is what a reader is allowed to do, and still goes to the network
    await providerFetch('http://collab/ydoc/v1/docs/doc-id');

    expect(realFetch).toHaveBeenCalledTimes(1);
  });

  it('talks lib0-any on the http fallback unless json is asked for', async () => {
    const realFetch = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal('fetch', realFetch);

    const { fetch: providerFetch } = HttpProviderMock.mock.calls[0][3] as {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    };
    await providerFetch('http://collab/ydoc/v1/docs/doc-id');

    // no Accept added, and the cookie goes along as before
    expect(realFetch).toHaveBeenCalledWith(
      'http://collab/ydoc/v1/docs/doc-id',
      {
        credentials: 'include',
      },
    );
  });

  it('talks json on the http fallback when asked to', async () => {
    useProviderStore.getState().destroyProvider();
    HttpProviderMock.mockClear();
    const realFetch = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal('fetch', realFetch);

    useProviderStore
      .getState()
      .createProvider(
        'ws://localhost/collaboration/ws/v1/docs',
        'doc-id',
        undefined,
        { httpJson: true },
      );

    const { fetch: providerFetch } = HttpProviderMock.mock.calls[0][3] as {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    };
    await providerFetch('http://collab/ydoc/v1/docs/doc-id');

    // COLLABORATION_HTTP_FALLBACK_JSON_ENABLED: the firewalls that refuse
    // application/x-lib0any let application/json through
    const [, init] = realFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('accept')).toBe('application/json');
    expect(init.credentials).toBe('include');
  });

  it('still builds an editor in a browser that has no indexeddb', () => {
    useProviderStore.getState().destroyProvider();
    vi.stubGlobal('indexedDB', undefined);
    IndexeddbPersistenceMock.mockClear();

    useProviderStore
      .getState()
      .createProvider('ws://localhost/collaboration/ws/v1/docs', 'doc-id');

    expect(IndexeddbPersistenceMock).not.toHaveBeenCalled();
    expect(useProviderStore.getState().persistence).toBeUndefined();
    // the connection still drives the editor, exactly as before
    expect(useProviderStore.getState().provider).toBe(provider);
  });
});
