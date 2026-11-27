import {
  type VersionResult,
  type VersionSnapshot,
  type VersionStorage,
} from '@blocknote/core/extensions';
import { collectFragmentIds } from '@blocknote/core/y';
import * as Y from '@y/y';
import { fromBase64, toBase64 } from 'lib0/buffer';

import {
  APIError,
  CollaborationQuery,
  CollaborationTarget,
  fetchCollaborationAPI,
} from '@/api';

const TIMEOUT_MS = 30_000;
const DEFAULT_LIMIT = 50;

/** One `activity` entry, as the collaboration server answers it in json. */
interface ActivityEntry {
  from: number;
  to: number;
  by?: string[] | string | null;
  customAttributions?: { k: string; v: string }[] | null;
  version?: { name?: string; custom?: unknown } | null;
}

/**
 * Version history for the editor's sidebar, read from the collaboration server.
 *
 * It replaces BlockNote's `createYHubVersionStorage`, which cannot be used here:
 * its client asks for `application/x-lib0any` and offers no way to change that,
 * and some administration firewalls refuse binary answers. Every request goes
 * through `fetchCollaborationAPI` instead, so only json crosses the network, with
 * the binary fields in base64, and the session cookie goes with it.
 *
 * Only continuous history, previews, comparisons and restore are exposed: without
 * `create`, `rename` and `remove`, the sidebar offers no named versions.
 */
export const createDocsVersionStorage = (options: {
  target: CollaborationTarget;
  docId: string;
  fragment: Y.Node;
  /** Activity grouping and filters; `limit` is the page size. */
  activityParams?: CollaborationQuery;
}): VersionStorage<Uint8Array, Y.ContentMap> => {
  const { target, docId, fragment } = options;
  const liveDoc: unknown = fragment.doc;
  if (!(liveDoc instanceof Y.Doc)) {
    throw new Error(
      'Version history requires an attached collaboration document',
    );
  }

  /** `fetchCollaborationAPI`, with its failures turned into BlockNote's typed errors. */
  async function call<T>(
    endpoint: string,
    init: {
      query?: CollaborationQuery;
      body?: unknown;
      method?: string;
      signal?: AbortSignal;
    } = {},
  ): Promise<VersionResult<T>> {
    const { signal, ...rest } = init;
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    try {
      const value = await fetchCollaborationAPI<T>(target, endpoint, docId, {
        ...rest,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      return { ok: true, value };
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      if (timeout.aborted) {
        return {
          ok: false,
          error: {
            type: 'timeout',
            outcome: rest.method ? 'unknown' : 'unchanged',
          },
        };
      }
      if (error instanceof APIError) {
        const { status } = error;
        return {
          ok: false,
          error:
            status === 401 || status === 403
              ? { type: 'forbidden' }
              : status === 409 || status === 412
                ? { type: 'conflict' }
                : status === 404
                  ? { type: 'not-found' }
                  : { type: 'server', status },
        };
      }
      if (error instanceof TypeError) {
        return { ok: false, error: { type: 'network' } };
      }
      throw error;
    }
  }

  /** Read a base64 field of a json answer, failing loudly when it is missing. */
  async function binary(
    endpoint: string,
    field: string,
    init: Parameters<typeof call>[1],
  ): Promise<VersionResult<Uint8Array>> {
    const result = await call<Record<string, unknown>>(endpoint, init);
    if (!result.ok) {
      return result;
    }
    const value = result.value[field];
    if (typeof value !== 'string') {
      throw new Error(`The collaboration server returned no ${field}`);
    }
    return { ok: true, value: fromBase64(value) };
  }

  const getActivity = async (query: CollaborationQuery, signal: AbortSignal) =>
    call<{ activity: ActivityEntry[] }>('activity', { query, signal });

  /** Version ids are `{from}-{to}`, the bounds of an activity entry. */
  const parseId = (id: string) => {
    const range = /^(\d+)-(\d+)$/.exec(id);
    const from = Number(range?.[1]);
    const to = Number(range?.[2]);
    if (
      !Number.isSafeInteger(from) ||
      !Number.isSafeInteger(to) ||
      from > to ||
      !Number.isSafeInteger(to + 1)
    ) {
      throw new Error('Invalid version timestamp');
    }
    return { from, to };
  };

  const toSnapshot = (entry: ActivityEntry): VersionSnapshot => ({
    id: `${entry.from}-${entry.to}`,
    createdAt: entry.to,
    by: (Array.isArray(entry.by) ? entry.by : (entry.by?.split(',') ?? []))
      .map((author) => author?.trim())
      .filter(Boolean),
    name: entry.version?.name || undefined,
    metadata: entry.version?.custom,
    customAttributions: Object.fromEntries(
      entry.customAttributions?.map(({ k, v }) => [k, v]) ?? [],
    ),
  });

  return {
    // The newest entry is the current state: no separate local capture.
    showCurrentVersion: false,
    historyIncludesBeginning: true,

    async list(signal, cursor) {
      const query: CollaborationQuery = cursor
        ? Object.fromEntries(new URLSearchParams(cursor))
        : {
            order: 'desc',
            limit: DEFAULT_LIMIT,
            customAttributions: true,
            ...options.activityParams,
            versions: true,
          };
      const limit = Number(query.limit);
      if (!Number.isSafeInteger(limit) || limit <= 0) {
        throw new Error('Activity limit must be a positive integer');
      }

      // One extra entry tells whether there is a next page. The first page also
      // asks for the very first change, so the list always reaches the beginning.
      const [page, beginning] = await Promise.all([
        getActivity({ ...query, limit: limit + 1 }, signal),
        cursor
          ? undefined
          : getActivity(
              {
                from: 0,
                order: 'asc',
                limit: 1,
                group: false,
                versions: true,
                customAttributions: true,
              },
              signal,
            ),
      ]);
      if (!page.ok) {
        return page;
      }
      if (beginning && !beginning.ok) {
        return beginning;
      }

      const entries = page.value.activity.slice(0, limit);
      const last = entries.at(-1);
      let nextCursor: string | undefined;
      if (page.value.activity.length > limit && last && last.from > 0) {
        const next = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined) {
            next.set(key, String(value));
          }
        });
        next.set('to', String(last.from - 1));
        nextCursor = next.toString();
      }

      const snapshots = entries.map(toSnapshot);
      const first = beginning?.value.activity[0];
      if (first) {
        // The empty document just before the first change.
        const before = Math.max(0, first.from - 1);
        snapshots.push(
          toSnapshot({ ...first, from: before, to: before, version: null }),
        );
      }

      return { ok: true, value: { snapshots, nextCursor } };
    },

    async getContent(id, signal) {
      const content = await binary('changeset', 'ydoc', {
        query: { ydoc: true, to: parseId(id).to },
        signal,
      });
      return content.ok
        ? { ok: true, value: Y.convertUpdateFormatV1ToV2(content.value) }
        : content;
    },

    async getAttributions(selection, baselineId, _capturedAt, signal) {
      const attributions = await binary('changeset', 'attributions', {
        query: {
          from: parseId(baselineId).to + 1,
          to:
            selection.type === 'current' ? undefined : parseId(selection.id).to,
          attributions: true,
        },
        signal,
      });
      return attributions.ok
        ? { ok: true, value: Y.decodeContentMap(attributions.value) }
        : attributions;
    },

    async restore(id) {
      // No finite `to`: the IDs must cover the latest available editor state.
      const from = parseId(id).to + 1;
      // changeset retains deleted descendants inside this window, but collects
      // older deleted content. Unlike gc=false, it respects the access-date ray.
      const retained = await binary('changeset', 'ydoc', {
        query: { from, ydoc: true },
      });
      if (!retained.ok) {
        return retained;
      }
      const ids = collectFragmentIds(fragment, retained.value);
      // Native rollback is additive, not a lock: new IDs written after this
      // snapshot may survive. Other roots are excluded from both ID sets.
      const restored = await call('rollback', {
        method: 'POST',
        body: {
          from,
          contentIds: toBase64(
            Y.encodeContentIds({ inserts: ids, deletes: ids }),
          ),
        },
      });
      if (!restored.ok) {
        return restored;
      }
      // Success means the live doc received the restore, even if the websocket
      // is delayed. Fetch only current GC content, not restricted full history.
      const document = await binary('ydoc', 'doc', {});
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
