import * as Y from '@y/y';
import { decodeAny, encodeAny } from 'lib0/buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDocsVersionStorage } from '../createDocsVersionStorage';

type StorageOptions = Parameters<typeof createDocsVersionStorage>[0];

const encodedResponse = (value: unknown) =>
  new Response(encodeAny(value) as BodyInit);

describe('createDocsVersionStorage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let doc: Y.Doc;

  const createStorage = (options: Partial<StorageOptions> = {}) =>
    createDocsVersionStorage({
      baseUrl: 'https://example.test/collaboration',
      org: 'org/name',
      docId: 'doc/id',
      fragment: doc.get('document-store'),
      beforeRestoreName: 'Before restore',
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

  it('restores the range and beginning IDs returned by the native list', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/activity/')) {
        expect(url.searchParams.get('versions')).toBe('true');
        return encodedResponse({
          activity: [
            url.searchParams.get('order') === 'asc'
              ? { from: 100, to: 110, by: [] }
              : { from: 200, to: 250, by: [] },
          ],
        });
      }
      if (url.pathname.includes('/changeset/')) {
        return encodedResponse({ ydoc: Y.encodeStateAsUpdate(doc) });
      }
      if (url.pathname.includes('/rollback/')) {
        return new Response();
      }
      return encodedResponse({ doc: Y.encodeStateAsUpdate(doc) });
    });
    const storage = createStorage();
    const listed = await storage.list(new AbortController().signal);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      throw new Error('Expected history list');
    }
    expect(listed.value.snapshots.map(({ id }) => id)).toEqual([
      '200-250',
      '99-99',
    ]);

    for (const { id } of listed.value.snapshots) {
      expect(await storage.restore(id)).toEqual({ ok: true, value: undefined });
    }

    const changesets = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/changeset/'),
    );
    expect(
      changesets.map(([url]) => new URL(String(url)).searchParams.get('from')),
    ).toEqual(['251', '100']);
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
      await expect(createStorage().restore(id)).rejects.toThrow(
        'Invalid version timestamp',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(['0-0', '0-9007199254740990'])(
    'accepts the safe boundary ID %s',
    async (id) => {
      fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
      expect(await createStorage().restore(id)).toEqual({
        ok: false,
        error: { type: 'forbidden' },
      });
      const from = new URL(String(fetchMock.mock.calls[0][0])).searchParams.get(
        'from',
      );
      expect(from).toBe(String(Number(id.split('-')[1]) + 1));
    },
  );

  it('preserves bounded requests, deleted editor descendants and other roots', async () => {
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
        .mockResolvedValueOnce(encodedResponse({ ydoc: retained }))
        .mockResolvedValueOnce(new Response())
        .mockResolvedValueOnce(
          encodedResponse({ doc: Y.encodeStateAsUpdate(history) }),
        );

      const storage = createStorage({
        headers: { Authorization: 'Bearer test-token' },
        queryParams: { custom: 'value' },
      });
      expect(await storage.restore('100-250')).toEqual({
        ok: true,
        value: undefined,
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [changeset, rollback, current] = fetchMock.mock.calls;
      expect(String(changeset[0])).toBe(
        'https://example.test/collaboration/changeset/v1/org%2Fname/doc%2Fid?from=251&ydoc=true&custom=value',
      );
      expect(String(rollback[0])).toBe(
        'https://example.test/collaboration/rollback/v1/org%2Fname/doc%2Fid?custom=value',
      );
      expect(rollback[1]).toMatchObject({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/x-lib0any',
        },
      });
      const body = decodeAny(rollback[1]?.body as Uint8Array) as {
        from: number;
        contentIds: Uint8Array;
      };
      expect(body.from).toBe(251);
      expect(Y.decodeContentIds(body.contentIds)).toEqual({
        inserts: editorIds,
        deletes: editorIds,
      });
      expect(String(current[0])).toBe(
        'https://example.test/collaboration/ydoc/v1/org%2Fname/doc%2Fid?custom=value',
      );
      for (const [, init] of fetchMock.mock.calls) {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer test-token',
        });
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
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    expect(await createStorage().restore('100-250')).toEqual({
      ok: false,
      error: { type: 'forbidden' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves rollback conflicts without fetching or updating the live document', async () => {
    fetchMock
      .mockResolvedValueOnce(
        encodedResponse({ ydoc: Y.encodeStateAsUpdate(doc) }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 409 }));
    expect(await createStorage().restore('100-250')).toEqual({
      ok: false,
      error: { type: 'conflict' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(doc.get('document-store').toArray()).toEqual(['current']);
  });
});
