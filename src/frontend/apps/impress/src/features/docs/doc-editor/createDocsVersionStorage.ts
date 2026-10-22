import { type VersionResult } from '@blocknote/core/extensions';
import {
  type YHubVersionStorageOptions,
  collectFragmentIds,
  createYHubVersionStorage,
} from '@blocknote/core/y';
import * as Y from '@y/y';
import { decodeAny, encodeAny } from 'lib0/buffer';

/** Restore the editor using only history inside Docs' access-date boundary. */
export const createDocsVersionStorage = (
  options: YHubVersionStorageOptions & {
    fragment: Y.Node;
    beforeRestoreName: string;
  },
): Omit<
  ReturnType<typeof createYHubVersionStorage>,
  'create' | 'rename' | 'remove'
> => {
  const liveDoc: unknown = options.fragment.doc;
  if (!(liveDoc instanceof Y.Doc)) {
    throw new Error(
      'Version history requires an attached collaboration document',
    );
  }
  const storage = createYHubVersionStorage(options);
  const documentPath = `${encodeURIComponent(options.org)}/${encodeURIComponent(options.docId)}`;

  async function request<T>(
    endpoint: string,
    decode: (data: ArrayBuffer) => T,
    init?: RequestInit,
    params?: Record<string, string | number | boolean>,
  ): Promise<VersionResult<T>> {
    const query = new URLSearchParams(
      Object.entries({ ...params, ...options.queryParams })
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000);
    let data: ArrayBuffer;
    try {
      const response = await fetch(
        `${options.baseUrl}/${endpoint}/v1/${documentPath}${query.size ? `?${query}` : ''}`,
        {
          ...init,
          signal: timeout,
          headers: { ...options.headers, ...init?.headers },
        },
      );
      if (!response.ok) {
        return {
          ok: false,
          error:
            response.status === 401 || response.status === 403
              ? { type: 'forbidden' }
              : response.status === 409 || response.status === 412
                ? { type: 'conflict' }
                : response.status === 404
                  ? { type: 'not-found' }
                  : { type: 'server', status: response.status },
        };
      }
      data = await response.arrayBuffer();
    } catch (error) {
      if (timeout.aborted) {
        return {
          ok: false,
          error: {
            type: 'timeout',
            outcome: init?.method ? 'unknown' : 'unchanged',
          },
        };
      }
      if (error instanceof TypeError) {
        return { ok: false, error: { type: 'network' } };
      }
      throw error;
    }
    return { ok: true, value: decode(data) };
  }

  return {
    // Optional mutation methods enable named-version actions in the sidebar.
    // Expose only continuous history, previews, comparisons and restore.
    showCurrentVersion: storage.showCurrentVersion,
    historyIncludesBeginning: storage.historyIncludesBeginning,
    list: storage.list,
    getContent: storage.getContent,
    getAttributions: storage.getAttributions,
    async restore(id) {
      const to = Number(id);
      if (
        !Number.isSafeInteger(to) ||
        to < 0 ||
        to === Number.MAX_SAFE_INTEGER
      ) {
        throw new Error('Invalid version timestamp');
      }
      // changeset retains deleted descendants inside this window, but collects
      // older deleted content. Unlike gc=false, it respects the access-date ray.
      // No finite `to`: the IDs must cover the latest available editor state.
      const from = to + 1;
      const retained = await request(
        'changeset',
        (data) => {
          const { ydoc } = decodeAny(new Uint8Array(data)) as {
            ydoc?: Uint8Array;
          };
          if (!ydoc) {
            throw new Error('YHub returned no changeset document');
          }
          return ydoc;
        },
        undefined,
        { from, ydoc: true },
      );
      if (!retained.ok) {
        return retained;
      }
      const ids = collectFragmentIds(options.fragment, retained.value);
      // Native rollback is additive, not a lock: new IDs written after this
      // snapshot may survive. Other roots are excluded from both ID sets.
      const restored = await request('rollback', () => undefined, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-lib0any' },
        body: encodeAny({
          from,
          contentIds: Y.encodeContentIds({ inserts: ids, deletes: ids }),
        }) as BodyInit,
      });
      if (!restored.ok) {
        return restored;
      }
      // Success means the live doc received the restore, even if the websocket
      // is delayed. Fetch only current GC content, not restricted full history.
      const document = await request('ydoc', (data) => {
        const { doc } = decodeAny(new Uint8Array(data)) as { doc?: Uint8Array };
        if (!doc) {
          throw new Error('YHub returned no document state');
        }
        return doc;
      });
      if (!document.ok) {
        return document.error.type === 'timeout'
          ? { ok: false, error: { type: 'timeout', outcome: 'unknown' } }
          : document;
      }
      Y.applyUpdate(liveDoc, document.value);
      return { ok: true, value: undefined };
    },
  };
};
