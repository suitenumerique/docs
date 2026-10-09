/**
 * Drop the local copy of every document that has not been opened for
 * `retentionDays` (the instance's `COLLABORATION_LOCAL_DOC_RETENTION_DAYS`),
 * plus any copy on disk that the index has lost track of where the browser lets
 * us enumerate.
 *
 * `IndexeddbPersistence` has no expiry of its own, so without this every
 * document ever opened is kept until the browser evicts it under storage
 * pressure — which it does without asking and without order.
 *
 * Run once on startup rather than on a timer: it must not run while this tab has
 * a document open — it would delete the database that document's provider is
 * writing to — and a document opened today is not a candidate anyway.
 *
 * Returns the ids it dropped, which is what the tests read.
 */

import { openDB } from 'idb';
import { validate as uuidValidate } from 'uuid';
import { clearDocument } from 'y-indexeddb';

const DAY_MS = 24 * 60 * 60 * 1000;

const INDEX_DB = 'docs-local-index';
const INDEX_STORE = 'opened';

const openIndex = () =>
  openDB(INDEX_DB, 1, {
    upgrade: (db) => {
      db.createObjectStore(INDEX_STORE);
    },
  });

/**
 * `indexedDB.deleteDatabase` blocks silently while a connection is open — a copy
 * of this document held by another tab — and never resolves. The sweep must not
 * hang on one, so a delete that has not returned in a few seconds is abandoned
 * and left for the next startup, by when that tab has likely gone.
 */
const DELETE_TIMEOUT_MS = 4000;

const drop = (docId: string) =>
  Promise.race([
    clearDocument(docId),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`deleting ${docId} timed out`)),
        DELETE_TIMEOUT_MS,
      ),
    ),
  ]);

/**
 * Record that a document has just been opened, which is what keeps its local
 * copy alive.
 *
 * Best effort: if this write is lost, the sweep's enumeration still finds the
 * copy, and the worst case is that a document opened once and never again is
 * kept an extra cycle rather than dropped on time.
 */
export const rememberLocalDoc = async (docId: string) => {
  try {
    const db = await openIndex();
    await db.put(INDEX_STORE, Date.now(), docId);
    db.close();
  } catch (error) {
    console.error(
      'Failed to record the local copy of a document',
      docId,
      error,
    );
  }
};

export const sweepLocalDocs = async (retentionDays: number) => {
  let db;
  try {
    db = await openIndex();
  } catch (error) {
    console.error('Failed to open the local document index', error);
    return [];
  }

  const expiry = Date.now() - retentionDays * DAY_MS;

  // id -> last opened, from the index. `getAllKeys` and `getAll` return in the
  // same order, so they zip.
  const opened = new Map<string, number>();
  const keys = await db.getAllKeys(INDEX_STORE);
  const times = await db.getAll(INDEX_STORE);
  keys.forEach((id, i) => {
    if (typeof id === 'string' && typeof times[i] === 'number') {
      opened.set(id, times[i]);
    }
  });

  const present = new Set<string>();
  if (typeof indexedDB !== 'undefined' && 'databases' in indexedDB) {
    try {
      for (const { name } of await indexedDB.databases()) {
        if (name && uuidValidate(name)) {
          present.add(name);
        }
      }
    } catch (error) {
      console.error('Failed to enumerate the local documents', error);
    }
  }

  const dropped: string[] = [];

  for (const id of new Set([...opened.keys(), ...present])) {
    const at = opened.get(id);

    // known to the index and still fresh
    if (at !== undefined && at > expiry) {
      continue;
    }

    try {
      await drop(id);
      if (opened.has(id)) {
        await db.delete(INDEX_STORE, id);
      }
      dropped.push(id);
    } catch (error) {
      // left as it is, so the next startup tries again
      console.error('Failed to drop the local copy of a document', id, error);
    }
  }

  db.close();
  return dropped;
};
