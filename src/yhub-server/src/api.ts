/**
 * The custom REST endpoints, mounted under `/collaboration/` alongside yhub's
 * built-ins and the websocket route. Every handler reaches yhub through
 * `req.yhub`, so this file holds no reference to the instance `server.ts`
 * creates — it only has to be handed to `createYHub`'s `server.api`.
 *
 * Access to each route is settled by the permission tables in `permissions.ts`
 * (yhub runs them before a handler is called); the branch/org/uuid checks here
 * are the second fence the admin token needs, since it is not scoped to `main`
 * or to this org by `authorize`.
 */
import {
  checkPermissions,
  createApiEndpoint,
  createDocumentPermissions,
  logger,
} from '@y/hub';

import { backendPublicJwk } from './backend.js';
import {
  EMPTY_UPDATE_MAX_BYTES,
  EMPTY_YDOC,
  MAX_CREATE_BYTES,
  ORG,
  READINESS_TIMEOUT_MS,
  UUID4,
} from './config.js';
import { SOFT_MIGRATION, fullMigrate } from './migration.js';
import type { AppAuthInfo, DocRef, YHub } from './yhub.js';

// Mimic the old y-provider REST responses (JSON, not yhub's lib0-any
// encoding) so the Django caller keeps its historical contract.
const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// Does the room hold anything? Covers persisted rows and the messages still on
// the stream, which is what makes it an answer about the content rather than
// about the storage.
const hasContent = async (yhubApi: YHub, docRef: DocRef): Promise<boolean> => {
  const { gcDoc } = await yhubApi.getDoc(
    docRef,
    { gc: true, nongc: false },
    { gcOnMerge: false },
  );
  return gcDoc != null && gcDoc.byteLength > EMPTY_UPDATE_MAX_BYTES;
};

// Erase every trace of a room's content and leave it writable again.
//
// The erasure is yhub's hard deletion: it clears the stream, disconnects the
// editors and drops every row and asset, irreversibly. Its tombstone is also
// the barrier that stops a compaction still in flight from writing the content
// back — every `store` is refused while it is there, and the purge runs behind
// it — so the room is only made writable again, by dropping the tombstone,
// once there is nothing left to write back.
//
// Dropping the tombstone is what makes this a reset rather than a deletion:
// yhub has no such operation, a hard deletion is final for the room and even
// `restoreDoc` refuses it. Here the document id belongs to a Django document
// that goes on living, so the room has to be usable again.
const eraseContent = async (
  yhubApi: YHub,
  docRef: DocRef,
  by: string,
): Promise<void> => {
  await yhubApi.deleteDoc(docRef, { hard: true, by });
  await yhubApi.persistence.deleteTombstone(docRef);
};

const readyLog = logger.child({ module: 'readiness' });
const resetLog = logger.child({ module: 'reset-ydoc' });

// One readiness check: is that store answering? The error never leaves the
// server — the route is unauthenticated, and a postgres client is happy to put
// its connection string, password included, in the message it raises.
const checkStore = async (
  name: string,
  probe: () => PromiseLike<unknown>,
): Promise<[string, string]> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`no answer in ${READINESS_TIMEOUT_MS}ms`)),
          READINESS_TIMEOUT_MS,
        );
      }),
    ]);
    return [name, 'ok'];
  } catch (err) {
    readyLog.warn(
      { store: name, err: err instanceof Error ? err.message : String(err) },
      'store is unreachable',
    );
    return [name, 'unreachable'];
  } finally {
    clearTimeout(timer);
  }
};

export const api = [
  // GET /collaboration/ping/v1 — liveness. It answers, therefore the http
  // channel and the event loop are alive, which is all a liveness probe should
  // ever conclude: touching redis or postgres here would restart a server that
  // holds perfectly good websocket connections every time a store blinks.
  createApiEndpoint('ping', {
    scope: 'global',
    get: {
      handler: () => jsonResponse(200, { status: 'pong' }),
    },
  }),
  // GET /collaboration/ready/v1 — readiness. The two stores this server cannot
  // serve a single document without: the postgres holding the persisted state
  // and the redis carrying the updates between replicas. Answering 503 takes
  // this pod out of the service endpoints and leaves the others serving, which
  // is the whole difference with the liveness probe above.
  createApiEndpoint('ready', {
    scope: 'global',
    get: {
      handler: async (req) => {
        // both at once: a probe is not the place to add the latency of one
        // store to the latency of the other
        const checks = Object.fromEntries(
          await Promise.all([
            checkStore('postgres', () => req.yhub.persistence.sql`SELECT 1`),
            checkStore('redis', () => req.yhub.stream.redis.ping()),
          ]),
        );
        const ready = Object.values(checks).every((state) => state === 'ok');
        return jsonResponse(ready ? 200 : 503, {
          status: ready ? 'ready' : 'unready',
          checks,
        });
      },
    },
  }),
  // GET /collaboration/jwks/v1 — the public keys verifying the tokens we sign
  // to call the backend, in the JSON Web Key Set format (RFC 7517). Global
  // scope: it is about this server, not about a document, so the route carries
  // no org and no docid. The counterpart of the backend's own /api/v1.0/jwks,
  // which we read above to verify its tokens: neither side stores a copy of
  // the other's key, so either can be rolled without the other being changed.
  createApiEndpoint('jwks', {
    scope: 'global',
    get: {
      // an empty set when no key is configured: honest, and the backend
      // refuses our (equally absent) tokens rather than trusting anything
      handler: () =>
        jsonResponse(200, {
          keys: backendPublicJwk == null ? [] : [backendPublicJwk],
        }),
    },
  }),
  // POST /collaboration/reset-connections/v1/{org}/{docid} — replaces
  // y-provider's /collaboration/api/reset-connections/?room=. Doc-scoped, so
  // the docRef comes from the path; access is the admin token's alone, because
  // the browser's grant names no `reset-connections` endpoint and has no `'*'`
  // fallback. uws routes are exact: a trailing slash 404s.
  createApiEndpoint('reset-connections', {
    post: {
      handler: async (req) => {
        const userId = req.headers['x-user-id'] || null;
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        // in-place recheck: every yhub server re-runs `authorize` per
        // matching connection and closes 4401 only when the access changed —
        // no reconnect churn for unaffected clients
        await req.yhub.recheckAuth(req.docRef, {
          users: userId ? [userId] : null,
        });
        return jsonResponse(200, { message: 'Connections reset' });
      },
    },
  }),
  // POST /collaboration/migrate/v1/{org}/{docid} — replay a document's full
  // legacy version history from the S3 media bucket into yhub (see README.md).
  // Backend-internal, like reset-connections: gated to the admin token via the
  // 'migrate' access purpose, since it writes history and reads the legacy
  // store.
  createApiEndpoint('migrate', {
    post: {
      handler: async (req) => {
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        if (req.branch !== 'main') {
          // the legacy store is branchless: `{docid}/file` is the main branch
          return jsonResponse(400, { error: 'Unknown branch' });
        }
        if (!SOFT_MIGRATION) {
          // the flag is what configures the S3 client (migration.ts)
          return jsonResponse(503, { error: 'Legacy store is not configured' });
        }
        // ?force=true replays a document that is already in the migrated set.
        // Only safe while its clock-0 row is still there: once compaction has
        // folded that row away, a second replay attributes the same content a
        // second time and the activity timestamps become ambiguous.
        const { status, ...stats } = await fullMigrate(req.yhub, req.docRef, {
          force: req.query.force === 'true',
        });
        // `status` is what a backfill driver records per document: 'ok',
        // 'already', 'empty' (no legacy object — a brand-new document) or
        // 'nothing' (versions exist, none readable). All four are done, hence
        // one 2xx; `message` says the same thing to a human, `migrated`
        // whether this call is the one that wrote the history.
        const messages: Record<typeof status, string> = {
          already: 'Already migrated',
          empty: 'No legacy document in s3',
          nothing: 'No usable content in the legacy versions',
          ok: 'Migration completed',
        };

        return jsonResponse(200, {
          status,
          message: messages[status],
          migrated: status === 'ok',
          ...stats,
        });
      },
    },
  }),
  // POST /collaboration/create-ydoc/v1/{org}/{docid} — create a document's
  // initial Yjs state from a RAW binary update (`Y.encodeStateAsUpdate` /
  // pycrdt `get_update()` output) posted as application/octet-stream.
  //
  // The built-in `PATCH ydoc` takes the same update (base64, in a json body
  // since 0.5.0) but neither of the two things this endpoint exists for: it is
  // a strict create, answering 409 when the room already has content, and it
  // attributes the content to the user named in `X-User-Id` rather than to the
  // backend making the call. Reads have no such needs and use the built-in
  // `GET ydoc`. Default access purpose: guarded like the built-in ydoc routes
  // (write access on the doc — the admin JWT, or a user session with update
  // ability).
  createApiEndpoint('create-ydoc', {
    post: {
      handler: async (req) => {
        // The endpoint facet already admitted this caller — only the admin
        // token names this route — but the write itself is a separate facet, and
        // yhub's contract is that a handler states the facets it touches. Cheap,
        // and it keeps the grant honest if the tables above ever widen.
        checkPermissions(
          req.permissions,
          createDocumentPermissions({ ydoc: '--u-' }),
        );
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        if (req.branch !== 'main') {
          // cookie users are main-only via `authorize`, but the admin
          // token bypasses it — reject explicitly so an admin create can't
          // seed an orphan non-main room (and dodge the 409 check, which is
          // branch-scoped)
          return jsonResponse(400, { error: 'Unknown branch' });
        }
        const body = await req.bytes();
        // req.bytes() resolves to a Node Buffer, but the compute-task schema
        // requires an exact Uint8Array (lib0 $constructedBy compares the
        // constructor) — re-view the same bytes without copying
        const update = new Uint8Array(
          body.buffer,
          body.byteOffset,
          body.byteLength,
        );
        if (update.byteLength > MAX_CREATE_BYTES) {
          // 413 is missing from yhub's status-line map (503 was added in
          // 0.5.0, 413 was not), so the reason phrase is empty
          // ("HTTP/1.1 413 ") — legal, and callers switch on the code
          return jsonResponse(413, { error: 'Update too large' });
        }
        // yhub's "no effective content" convention — reject before it reaches
        // a worker
        if (update.byteLength <= EMPTY_UPDATE_MAX_BYTES) {
          return jsonResponse(400, { error: 'Empty update' });
        }
        // covers persisted state AND uncompacted stream messages. Not atomic
        // with addMessage below (yhub has no atomic create): two concurrent
        // creates can both pass the check and their updates merge — with
        // independently generated updates (fresh clientIDs) the seeded
        // content then appears twice. Accepted: Django creates each doc
        // once, and a duplicated seed is user-fixable, unlike corruption.
        const { gcDoc } = await req.yhub.getDoc(
          req.docRef,
          { gc: true, nongc: false },
          { gcOnMerge: false },
        );
        if (gcDoc != null && gcDoc.byteLength > EMPTY_UPDATE_MAX_BYTES) {
          return jsonResponse(409, { error: 'Document already exists' });
        }
        // Only the backend admin token may attribute the content to another
        // user; regular callers always author as themselves — honoring a
        // client-supplied header would let any editor forge the attribution
        // history (the ws path likewise stamps the server-side identity).
        const authInfo = req.authInfo as AppAuthInfo | null;
        if (authInfo == null) {
          return jsonResponse(401, { error: 'Authentication required' });
        }
        const userid =
          (authInfo.admin === true && req.headers['x-user-id']) ||
          authInfo.userid;
        let result;
        try {
          // diffs the posted update against the (empty) current doc and
          // stamps the attribution contentmap
          result = await req.yhub.computePool.patchYdoc(
            {
              update,
              currentDoc: gcDoc ?? EMPTY_YDOC,
              userid,
              customAttributions: [],
            },
            { docRef: req.docRef },
          );
        } catch {
          // a malformed update makes the compute worker throw (yhub logs
          // 'worker failed' and replaces the thread). The update is the only
          // untrusted input here, so a rejection maps to 400; getDoc /
          // addMessage failures stay generic 500s.
          return jsonResponse(400, { error: 'Invalid Yjs update' });
        }
        if (result == null) {
          // structurally valid but no effective content (e.g. delete-set
          // only). A "successful" create that leaves the room nonexistent
          // would lie to the caller — a later create would not 409.
          return jsonResponse(400, { error: 'Empty update' });
        }
        // on a fresh room this creates the stream, schedules compaction, and
        // fans out to any live subscribers — nothing else to do
        await req.yhub.stream.addMessage(req.docRef, {
          type: 'ydoc:update:v1',
          contentmap: result.contentmap,
          update: result.update,
        });
        return jsonResponse(201, { message: 'Document created' });
      },
    },
  }),
  // POST /collaboration/restore-ydoc/v1/{org}/{docid} — undo the deletion of a
  // document, putting back what `DELETE .../ydoc/` took away.
  //
  // Deleting has a built-in route, restoring does not: yhub 0.6.0 exposes
  // `restoreDoc` to the process embedding it and nothing else. Backend-internal
  // like reset-connections and migrate, gated to the admin token by the
  // 'restore' purpose — a document leaves the trashbin because the backend
  // says so, never because an editor asked.
  createApiEndpoint('restore-ydoc', {
    post: {
      handler: async (req) => {
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        if (req.branch !== 'main') {
          // as in create-ydoc: the admin token is not fenced to main by
          // `authorize`, and a deletion is recorded per branch
          return jsonResponse(400, { error: 'Unknown branch' });
        }
        // read the deletion before undoing it: `restoreDoc` throws a plain
        // Error for a document whose content was erased, and that is a
        // conflict to report as one — catching around the call would turn
        // every failure alike, a database outage included, into the same answer
        const tombstone = await req.yhub.persistence.retrieveTombstone(
          req.docRef,
        );
        if (tombstone == null) {
          // not an error: the backend restores a whole subtree, of which only
          // the part that was deleted with it has anything to put back
          return jsonResponse(200, {
            message: 'Document is not deleted',
            restored: false,
          });
        }
        if (tombstone.hard || tombstone.purgedAt != null) {
          return jsonResponse(409, { error: 'Document content was erased' });
        }
        await req.yhub.restoreDoc(req.docRef);
        return jsonResponse(200, {
          message: 'Document restored',
          restored: true,
        });
      },
    },
  }),
  // POST /collaboration/reset-ydoc/v1/{org}/{docid} — erase the content of a
  // document and leave the room usable, as if it had never been written.
  //
  // What the backend's `clean_document` command needs to reset the onboarding
  // sandbox: the Django document keeps its id and goes on being edited, so
  // deleting the room is not an option — a hard deletion is final and even a
  // soft one would answer 404 for a document that still exists. Backend-internal
  // and admin-only, like the deletions it is built on: this destroys content
  // with no way back.
  createApiEndpoint('reset-ydoc', {
    post: {
      handler: async (req) => {
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        if (req.branch !== 'main') {
          return jsonResponse(400, { error: 'Unknown branch' });
        }
        const authInfo = req.authInfo as AppAuthInfo | null;
        const by = req.headers['x-user-id'] || authInfo?.userid;
        if (!by) {
          return jsonResponse(401, { error: 'Authentication required' });
        }
        // No `checkPermissions` here, deliberately. The honest facet for what
        // follows would be `delete: ['hard']`, and the admin grant withholds
        // `'hard'` on purpose so that `DELETE /ydoc?hard=true` stays refused over
        // REST. The erasure below reaches `deleteDoc` programmatically, which the
        // `delete` facet does not gate; the endpoint facet — this route is named
        // by no browser grant — is what admits the caller.
        // Nothing compacts this room while the erasure runs: this drops the
        // task already waiting for it and refuses to enqueue another, which
        // leaves one writer to race with — a task a worker had claimed before
        // this call. The tombstone barrier covers it right up to the moment
        // the room is made writable again, so it can only land after that,
        // and the second pass below is what picks it up.
        await req.yhub.stream.disableCompaction(req.docRef);
        try {
          await eraseContent(req.yhub, req.docRef, by);
          if (await hasContent(req.yhub, req.docRef)) {
            resetLog.warn(
              { docid: req.docid },
              'content came back while it was being erased, erasing again',
            );
            await eraseContent(req.yhub, req.docRef, by);
            if (await hasContent(req.yhub, req.docRef)) {
              // saying it is erased when it is not is the one answer this
              // endpoint must never give
              return jsonResponse(500, {
                error: 'Document content came back after being erased',
              });
            }
          }
        } finally {
          // even on failure: leaving compaction off would freeze the room for
          // every later edit, a worse state than the one we came to fix
          await req.yhub.stream.enableCompaction(req.docRef);
        }
        return jsonResponse(200, { message: 'Document content erased' });
      },
    },
  }),
];
