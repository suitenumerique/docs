import * as Y from '@y/y';
import { decodeAny, encodeAny } from 'lib0/buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpFallback } from '../httpFallback';

const URL = 'http://collab/ydoc';

describe('HttpFallback', () => {
  let doc: Y.Doc;
  let server: Y.Doc;
  let fallback: HttpFallback;
  const send = vi.fn<typeof fetch>();
  const onSync = vi.fn();
  const onRefused = vi.fn();

  const createFallback = (readOnly = false) =>
    new HttpFallback(
      doc,
      URL,
      undefined,
      onSync,
      onRefused,
      readOnly,
      10_000,
      send,
    );

  const patches = () =>
    send.mock.calls.filter(([, init]) => init?.method === 'PATCH');

  const publishedUpdate = (index: number) => {
    const [, init] = patches()[index];
    return (decodeAny(init?.body as Uint8Array) as { update: Uint8Array })
      .update;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    doc = new Y.Doc();
    server = new Y.Doc();
    send
      .mockReset()
      .mockImplementation(async (_input, init) =>
        init?.method === 'PATCH'
          ? new Response(null, { status: 204 })
          : new Response(
              new Uint8Array(encodeAny({ doc: Y.encodeStateAsUpdate(server) })),
            ),
      );
    fallback = createFallback();
  });

  afterEach(() => {
    fallback.destroy();
    doc.destroy();
    server.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('retains no pending updates while the websocket transport is healthy', async () => {
    for (let index = 0; index < 1000; index++) {
      doc.get('content').insert(index, 'a');
    }

    await vi.advanceTimersByTimeAsync(60_000);

    expect(Reflect.get(fallback, 'pending')).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('publishes the current offline content on every activation', async () => {
    doc.get('content').insert(0, 'offline');
    fallback.connect();
    await vi.advanceTimersByTimeAsync(0);
    Y.applyUpdate(server, publishedUpdate(0));
    expect(server.get('content').toString()).toBe('offline');

    fallback.disconnect();
    doc.get('content').insert(7, ' again');
    expect(Reflect.get(fallback, 'pending')).toBeUndefined();

    fallback.connect();
    await vi.advanceTimersByTimeAsync(0);
    Y.applyUpdate(server, publishedUpdate(1));

    expect(server.get('content').toString()).toBe('offline again');
    expect(onSync).toHaveBeenCalledTimes(2);
  });

  it('retries a failed PATCH together with edits made before the retry', async () => {
    send.mockResolvedValueOnce(new Response(null, { status: 503 }));
    doc.get('content').insert(0, 'before');
    fallback.connect();
    await vi.advanceTimersByTimeAsync(0);

    expect(fallback.synced).toBe(false);
    expect(onSync).not.toHaveBeenCalled();
    doc.get('content').insert(6, ' retry');
    await vi.advanceTimersByTimeAsync(10_000);
    Y.applyUpdate(server, publishedUpdate(1));

    expect(server.get('content').toString()).toBe('before retry');
    expect(fallback.synced).toBe(true);
  });

  it.each(['PATCH', 'GET'])(
    'keeps edits made during an in-flight %s in one merged pending update',
    async (method) => {
      let resolveRequest!: (response: Response) => void;
      const response = new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      });
      if (method === 'GET') {
        send.mockResolvedValueOnce(new Response(null, { status: 204 }));
      }
      send.mockReturnValueOnce(response);
      doc.get('content').insert(0, 'before');
      fallback.connect();
      await vi.advanceTimersByTimeAsync(0);

      for (let index = 0; index < 100; index++) {
        doc.get('content').insert(6 + index, 'a');
      }
      expect(fallback).toHaveProperty('pending', expect.any(Uint8Array));
      resolveRequest(
        method === 'PATCH'
          ? new Response(null, { status: 204 })
          : new Response(new Uint8Array(encodeAny({}))),
      );
      await vi.advanceTimersByTimeAsync(1000);

      expect(patches()).toHaveLength(2);
      Y.applyUpdate(server, publishedUpdate(0));
      Y.applyUpdate(server, publishedUpdate(1));
      expect(server.get('content').toString()).toBe(`before${'a'.repeat(100)}`);
      expect(Reflect.get(fallback, 'pending')).toBeUndefined();
    },
  );

  it.each(['resolve', 'reject'])(
    'ignores an old aborted round that later %ss after reactivation',
    async (outcome) => {
      let resolveRequest!: (response: Response) => void;
      let rejectRequest!: (error: Error) => void;
      const response = new Promise<Response>((resolve, reject) => {
        resolveRequest = resolve;
        rejectRequest = reject;
      });
      send.mockReturnValueOnce(response);
      doc.get('content').insert(0, 'before');
      fallback.connect();
      await vi.advanceTimersByTimeAsync(0);
      const oldSignal = send.mock.calls[0][1]?.signal;
      fallback.disconnect();
      expect(oldSignal?.aborted).toBe(true);

      doc.get('content').insert(6, ' after');
      fallback.connect();
      await vi.advanceTimersByTimeAsync(0);
      Y.applyUpdate(server, publishedUpdate(1));
      expect(server.get('content').toString()).toBe('before after');

      if (outcome === 'resolve') {
        resolveRequest(new Response(null, { status: 403 }));
      } else {
        rejectRequest(new Error('aborted'));
      }
      await vi.advanceTimersByTimeAsync(1000);

      expect(send).toHaveBeenCalledTimes(3);
      expect(onSync).toHaveBeenCalledTimes(1);
      expect(onRefused).not.toHaveBeenCalled();
      expect(Reflect.get(fallback, 'pending')).toBeUndefined();
      expect(fallback.synced).toBe(true);
    },
  );

  it('never PATCHes or queues updates for a read-only document', async () => {
    fallback.destroy();
    fallback = createFallback(true);
    server.get('content').insert(0, 'remote');
    doc.get('local').insert(0, 'offline');
    fallback.connect();
    await vi.advanceTimersByTimeAsync(0);
    doc.get('local').insert(7, ' edit');
    await vi.advanceTimersByTimeAsync(10_000);

    expect(patches()).toHaveLength(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(doc.get('content').toString()).toBe('remote');
    expect(Reflect.get(fallback, 'pending')).toBeUndefined();
    expect(fallback.synced).toBe(true);
  });
});
