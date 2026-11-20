import * as Y from '@y/y';
import { fromBase64, toBase64 } from 'lib0/buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDocsVersionStorage } from '../createDocsVersionStorage';

type StorageOptions = Parameters<typeof createDocsVersionStorage>[0];

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('createDocsVersionStorage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let doc: Y.Doc;

  const createStorage = (options: Partial<StorageOptions> = {}) =>
    createDocsVersionStorage({
      target: {
        serverUrl: 'https://example.test/collaboration',
        org: 'org-name',
      },
      docId: 'doc-id',
      fragment: doc.get('document-store'),
      ...options,
    });

  beforeEach(() => {
    doc = new Y.Doc();
    doc.get('document-store').insert(0, ['current']);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    doc.destroy();
    vi.unstubAllGlobals();
  });

  it('speaks json only, with the session cookie, on every request', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/activity/')) {
        return jsonResponse({ activity: [{ from: 200, to: 250, by: [] }] });
      }
      if (url.pathname.includes('/changeset/')) {
        return jsonResponse({
          ydoc: toBase64(Y.encodeStateAsUpdate(doc)),
          attributions: toBase64(Y.encodeContentMap(Y.createContentMap())),
        });
      }
      if (url.pathname.includes('/rollback/')) {
        return jsonResponse({ success: true });
      }
      return jsonResponse({ doc: toBase64(Y.encodeStateAsUpdate(doc)) });
    });
    const storage = createStorage();
    const signal = new AbortController().signal;

    expect((await storage.list(signal)).ok).toBe(true);
    expect((await storage.getContent('200-250', signal)).ok).toBe(true);
    expect(
      (
        await storage.getAttributions?.(
          { type: 'current' },
          '200-250',
          0,
          signal,
        )
      )?.ok,
    ).toBe(true);
    expect(await storage.restore?.('200-250')).toEqual({
      ok: true,
      value: undefined,
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(5);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe('include');
      expect(init?.headers).toMatchObject({ Accept: 'application/json' });
      if (init?.body !== undefined) {
        expect(typeof init.body).toBe('string');
      }
    }
  });

  it('restores the range and beginning IDs returned by the list', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/activity/')) {
        expect(url.searchParams.get('versions')).toBe('true');
        return jsonResponse({
          activity: [
            url.searchParams.get('order') === 'asc'
              ? { from: 100, to: 110, by: [] }
              : { from: 200, to: 250, by: 'alice, bob' },
          ],
        });
      }
      if (url.pathname.includes('/changeset/')) {
        return jsonResponse({ ydoc: toBase64(Y.encodeStateAsUpdate(doc)) });
      }
      if (url.pathname.includes('/rollback/')) {
        return jsonResponse({ success: true });
      }
      return jsonResponse({ doc: toBase64(Y.encodeStateAsUpdate(doc)) });
    });
    const storage = createStorage();
    const listed = await storage.list(new AbortController().signal);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      throw new Error('Expected history list');
    }
    expect(listed.value.snapshots.map(({ id, by }) => [id, by])).toEqual([
      ['200-250', ['alice', 'bob']],
      ['99-99', []],
    ]);

    for (const { id } of listed.value.snapshots) {
      expect(await storage.restore?.(id)).toEqual({
        ok: true,
        value: undefined,
      });
    }

    const changesets = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/changeset/'),
    );
    expect(
      changesets.map(([url]) => new URL(String(url)).searchParams.get('from')),
    ).toEqual(['251', '100']);
  });

  it('pages through the history with an opaque cursor', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get('order') === 'asc') {
        return jsonResponse({ activity: [{ from: 10, to: 20, by: [] }] });
      }
      return jsonResponse({
        activity: url.searchParams.has('to')
          ? [{ from: 10, to: 20, by: [] }]
          : [
              { from: 300, to: 350, by: [] },
              { from: 200, to: 250, by: [] },
            ],
      });
    });
    const storage = createStorage({ activityParams: { limit: 1 } });
    const signal = new AbortController().signal;

    const first = await storage.list(signal);
    if (!first.ok) {
      throw new Error('Expected history list');
    }
    expect(first.value.snapshots.map(({ id }) => id)).toEqual([
      '300-350',
      '9-9',
    ]);
    expect(first.value.nextCursor).toBeDefined();

    const second = await storage.list(signal, first.value.nextCursor);
    if (!second.ok) {
      throw new Error('Expected history list');
    }
    expect(second.value.snapshots.map(({ id }) => id)).toEqual(['10-20']);
    expect(second.value.nextCursor).toBeUndefined();
    const lastUrl = new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
    expect(lastUrl.searchParams.get('to')).toBe('299');
    expect(lastUrl.searchParams.get('limit')).toBe('2');
  });

  it.each([
    '',
    '250',
    'start',
    '0-',
    '-1',
    '-1-2',
    '0--1',
    '2-1',
    '1-2-3',
    '0.5-2',
    '0-2.5',
    '0-1e3',
    '0-0x10',
    '0-Infinity',
    'NaN-2',
    ' 0-2',
    '0-2 ',
    '0-2\n',
    '9007199254740992-9007199254740992',
    '0-9007199254740991',
    '0-9007199254740992',
  ])(
    'rejects malformed or unsafe ID %j before requesting history',
    async (id) => {
      await expect(createStorage().restore?.(id)).rejects.toThrow(
        'Invalid version timestamp',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(['0-0', '0-9007199254740990'])(
    'accepts the safe boundary ID %s',
    async (id) => {
      fetchMock.mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403));
      expect(await createStorage().restore?.(id)).toEqual({
        ok: false,
        error: { type: 'forbidden' },
      });
      const from = new URL(String(fetchMock.mock.calls[0][0])).searchParams.get(
        'from',
      );
      expect(from).toBe(String(Number(id.split('-')[1]) + 1));
    },
  );

  it('preserves deleted editor descendants and other roots', async () => {
    const history = new Y.Doc();
    try {
      const fragment = history.get('document-store');
      const child = new Y.Node();
      child.insert(0, ['deleted descendant']);
      fragment.insert(0, [child]);
      fragment.insert(1, ['current']);
      const editorIds = Y.createContentIdsFromUpdate(
        Y.encodeStateAsUpdate(history),
      ).inserts;
      history.get('comments').insert(0, ['keep comment']);
      const retained = Y.encodeStateAsUpdate(history);
      doc.destroy();
      doc = new Y.Doc();
      Y.applyUpdate(doc, retained);
      doc.get('document-store').delete(0, 1);
      history.get('metadata').setAttr('synced', true);
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ ydoc: toBase64(retained) }))
        .mockResolvedValueOnce(jsonResponse({ success: true }))
        .mockResolvedValueOnce(
          jsonResponse({ doc: toBase64(Y.encodeStateAsUpdate(history)) }),
        );

      const storage = createStorage();
      expect(await storage.restore?.('100-250')).toEqual({
        ok: true,
        value: undefined,
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [changeset, rollback, current] = fetchMock.mock.calls;
      expect(String(changeset[0])).toBe(
        'https://example.test/collaboration/changeset/v1/org-name/doc-id?from=251&ydoc=true',
      );
      expect(String(rollback[0])).toBe(
        'https://example.test/collaboration/rollback/v1/org-name/doc-id',
      );
      expect(rollback[1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = JSON.parse(String(rollback[1]?.body)) as {
        from: number;
        contentIds: string;
      };
      expect(body.from).toBe(251);
      expect(Y.decodeContentIds(fromBase64(body.contentIds))).toEqual({
        inserts: editorIds,
        deletes: editorIds,
      });
      expect(String(current[0])).toBe(
        'https://example.test/collaboration/ydoc/v1/org-name/doc-id',
      );
      for (const [, init] of fetchMock.mock.calls) {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
      }
      expect(doc.get('comments').toArray()).toEqual(['keep comment']);
      expect(doc.get('metadata').getAttr('synced')).toBe(true);
      expect(storage).not.toHaveProperty('create');
      expect(storage).not.toHaveProperty('rename');
      expect(storage).not.toHaveProperty('remove');
    } finally {
      history.destroy();
    }
  });

  it('stops before rollback when the bounded changeset is forbidden', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403));
    expect(await createStorage().restore?.('100-250')).toEqual({
      ok: false,
      error: { type: 'forbidden' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves rollback conflicts without fetching or updating the live document', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ ydoc: toBase64(Y.encodeStateAsUpdate(doc)) }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: 'conflict' }, 409));
    expect(await createStorage().restore?.('100-250')).toEqual({
      ok: false,
      error: { type: 'conflict' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(doc.get('document-store').toArray()).toEqual(['current']);
  });

  it('reports an unreachable server as a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await createStorage().list(new AbortController().signal)).toEqual({
      ok: false,
      error: { type: 'network' },
    });
  });
});
