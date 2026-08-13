# yhub-server

This directory contains the La Suite Docs-specific configuration for
[yhub](https://www.npmjs.com/package/@y/hub) (`@y/hub`), the collaboration
server that synchronizes Yjs documents between editors in real time.

It is not a fork of yhub — it is a thin wrapper:

- `server.js` — configuration, the auth plugin, and the custom REST endpoints,
- `migration.js` — everything that reads the legacy Django/S3 document store
  (both migrations described below),
- `env.js` — the `*_FILE` secret indirection shared by the two.

`server.js`:

- starts a yhub instance (websocket sync on port 3002, backed by Redis/Valkey
  and PostgreSQL),
- plugs in an auth plugin that resolves users and per-document access rights
  by calling the Docs Django backend (`/api/v1.0/users/me/` and
  `/api/v1.0/documents/{id}/`),
- serves every route under the `/collaboration/` prefix
  (`server.apiPrefix`), including the websocket sync route
  `/collaboration/ws/v1/{org}/{docid}`,
- exposes `POST /collaboration/reset-connections/v1/{org}/{docid}` (optional
  `X-User-Id` header), for the Django backend to re-check the authorization
  of a document's connected clients when permissions change (backend wiring
  pending) — authenticated with an RS256 admin JWT issued by Django and
  verified against its JWKS (`/api/v1.0/jwks`); the `reset-connections`
  purpose is granted only to that admin token, never to regular users,
- exposes `POST /collaboration/create-ydoc/v1/{org}/{docid}` (optional
  `X-User-Id` header naming the user the initial content is attributed to),
  which seeds a document's initial Yjs state from a raw binary update
  (`Y.encodeStateAsUpdate` / pycrdt `get_update()` output posted as
  `application/octet-stream`), so the Django backend can create documents
  server-side. The built-in `PATCH .../ydoc/` takes the same update, but this
  one is a **strict create** — 409 when the document already has content — and
  it credits the content to `X-User-Id` instead of to the caller. Guarded by
  standard document write access (the admin JWT, or a user session with update
  ability). Reading needs neither, and goes through the built-in `GET
  .../ydoc/`, which since 0.5.0 answers JSON (the update base64 encoded) to a
  request sending `Accept: application/json`,
- exposes `POST /collaboration/migrate/v1/{org}/{docid}`, which replays a
  document's **full** legacy version history out of the S3 media bucket (see
  "Full migration" below) — admin JWT only, like `reset-connections`,
- exposes `POST /collaboration/restore-ydoc/v1/{org}/{docid}`, which undoes the
  deletion of a document — admin JWT only, like `reset-connections`. Deleting
  one needs nothing custom, the built-in `DELETE .../ydoc/` does it (see
  "Deletion" below); restoring has no built-in route,
- exposes `POST /collaboration/reset-ydoc/v1/{org}/{docid}`, which erases the
  content of a document and leaves its room usable — admin JWT only, and
  irreversible (see "Deletion" below),
- notifies the Django backend on
  `POST /api/v1.0/documents/{id}/content-updated/` whenever the worker
  persists new content for a document, so that lists ordered by `updated_at`
  follow the edits made here. Signed with an RS256 JWT of our own
  (`YHUB_JWT_PRIVATE_KEY`, `aud: "docs-backend"`, one minute), best effort: a
  notification the backend refuses or never receives is logged and dropped,
- publishes the public half of that key on `GET /collaboration/jwks/v1`, where
  the backend reads it. The exact mirror of the JWKS the backend publishes for
  its own tokens: neither side is configured with a copy of the key of the
  other, so either can roll its key on its own. Served unauthenticated, as any
  JWKS is,
- mirrors the environment conventions used elsewhere in this repository
  (`*_FILE` secret indirection, `COLLABORATION_SERVER_ORIGIN` allowlist, …).

Public exposure: route the whole `/collaboration/` prefix to this server —
the websocket and the built-in document APIs (`ydoc`, `rollback`, `prune`,
`changeset`, `activity`) are all guarded by the same cookie-based document
authorization and are meant to be reachable by browsers, as is
`/collaboration/jwks/v1`, which carries public keys and nothing else. The one
exception is `/collaboration/reset-connections/`, `/collaboration/migrate/`,
`/collaboration/restore-ydoc/` and `/collaboration/reset-ydoc/`, which are
backend-internal and should not be routed through the public ingress.

## Container image

The `Dockerfile` has two final stages, like the other services of this
repository:

- `yhub-development` — what the `yhub` service of `compose.yml` builds. It
  installs the dev dependencies and starts the server through `npm run dev`
  (nodemon), and compose bind-mounts `src/yhub-server` over `/app`: **editing
  `server.js`, `migration.js` or `env.js` restarts the server, no rebuild**.
  Watch it happen with `docker compose logs -f yhub`. A syntax error stops at
  `app crashed - waiting for file changes` and the next save starts the server
  again,
- `yhub` — the production image: production dependencies only, `node
  server.js`, sources baked in, and the un-privileged user and the entrypoint
  the other services use (kubernetes runs the pod with `runAsNonRoot`).

Both are built **from the repository root**, like every other image here — the
entrypoint they share lives outside this directory:

```
docker build -f src/yhub-server/Dockerfile --target yhub .
```

nodemon rather than node's own `--watch`: the latter watches inodes, so it
stops seeing a file as soon as it is replaced by a rename — which is what `git
checkout` and most editors do when saving. The one-second `--delay` debounces
partial writes, so a branch switch restarts the server once, after the files
have settled.

Only source edits are picked up live. A dependency change (`package.json`) is a
rebuild, and `node_modules` lives in an anonymous volume that survives a plain
recreate, so it needs renewing:

```
make build-yhub
docker compose up -d --force-recreate --renew-anon-volumes yhub
```

## Database schema (`npm run init-db`)

yhub never runs DDL from the server or the worker, so the schema is created by
the script it ships (`node_modules/@y/hub/bin/init-db.js`), wrapped here as
`npm run init-db`. It reads `POSTGRES` from the environment, creates the
database when it does not exist, then every table and index the **installed**
yhub version needs. It is idempotent, so re-running it is always safe.

Run it whenever `@y/hub` is upgraded — releases that add a table or a column
say so in their changelog, and the server fails on every document read until
the DDL is applied (`relation "yhub_ydoc_tombstones_v1" does not exist`, for
instance). Nothing in this repository copies the schema, so an upgrade is
`package.json` plus this script and nothing else.

From the repository root, `make migrate-yhub` runs it against the dev stack —
the counterpart of `make migrate` for the Django database. `make bootstrap`
already includes it, so a fresh checkout needs nothing extra; an upgrade is
`make migrate-yhub` and restart the service.

## Deletion

The content of a document lives here, so deleting one in Docs has to be said
here too — otherwise the clients already connected keep editing it and the
content outlives the document. The backend does that from
`sync_service_deletions_in_cascade`, which walks the deleted subtree and tells
this server what became of each of its documents.

Deleting is `DELETE /collaboration/ydoc/v1/{org}/{docid}`, built into yhub
0.6.0. It is a **soft** deletion: the deletion is recorded, the clients editing
the document are disconnected (websocket close code 4404) and every route
answers 404 for it (`{"code": "doc-deleted"}`, which a document that was never
written does not — that one answers an empty document), but its content is left
untouched. Deleting twice keeps the date of the first deletion.

Restoring is the custom `POST /collaboration/restore-ydoc/v1/{org}/{docid}`
above: yhub 0.6.0 has no built-in route for it. The content was never touched,
so the document comes back with its whole history. Restoring one that is not
deleted answers 200 and changes nothing, which is what lets the backend restore
a subtree without asking what became of each document in it.

Erasing the content for good is a third operation (`YHub.deleteDoc(room, {
hard: true })`), reachable from inside this process only — yhub deliberately
keeps it off the REST API. It is not what deleting a document in Docs does: a
soft-deleted one simply stops being restorable after `TRASHBIN_CUTOFF_DAYS`,
and its content is kept. Note that a hard deletion is final for that room — the
docid can never be written again, and `restore-ydoc` answers 409 for it.

### Resetting (`POST /collaboration/reset-ydoc/v1/{org}/{docid}`)

One caller does erase content: the backend's `clean_document` command, which
resets the onboarding sandbox. It empties a document rather than deleting it —
the Django document keeps its id and goes on being edited — so neither deletion
fits: a soft one answers 404 for a document that still exists, and a hard one is
final for the room.

This endpoint hard-deletes and then drops the deletion record, which is what
leaves the room writable again. That order matters: the record is also the
barrier that refuses every write while the erasure runs, so a compaction that
was already merging cannot put the content back. Compaction is disabled for the
room around the whole sequence, and the content is read back afterwards — if it
reappeared, the erasure runs once more, and the endpoint answers 500 rather than
report an erasure it did not achieve.

Irreversible, admin JWT only, and backend-internal.

**Erasing a room does not erase the copies of it.** The editors are disconnected
(close code 4404), but a Yjs client holds the whole document in memory: one that
reconnects with its copy syncs it back into the empty room, and the content is
returned. The room accepting writes again is what makes this a reset rather than
a deletion, so the room itself cannot refuse them.

Connected clients could be dealt with, and deliberately are not: broadcasting an
update that deletes everything, before the kick, empties them for good — a Yjs
client with garbage collection on (what an editor runs, Docs refuses `gc=false`
connections to users) drops the deleted content rather than keeping it as
history, so it has nothing left to push back. What that does not cover is a
client that was offline or backgrounded at that moment, which comes back with
its copy intact either way.

So: reset a document when nobody is editing it, and have anyone who was reload
the page.

## Soft migration (`SOFT_MIGRATION=true`)

Documents were historically stored by the Django backend in the S3 media
bucket, as UTF-8 text that is the base64 encoding of a raw Yjs update, at key
`{document-uuid}/file`. With `SOFT_MIGRATION=true`, this server migrates those
documents into yhub lazily, on first access:

1. After a caller's document authorization succeeds — a user's, or the
   backend's own admin JWT, so a server-side read never sees an *empty*
   document where legacy content exists — the auth plugin checks
   whether yhub already has content for the room — the migrated set written by
   the full migration (below), then a bare postgres `SELECT` (persisted rows),
   then the valkey stream (uncompacted `ydoc:update:v1` messages), then the
   `SELECT` again to close the compaction race. Verdicts are cached in-process
   (existing docs 10 min, empty docs 60 s, failures 5 min).
2. If the room is unknown, the legacy object is fetched from S3 (10 s
   timeout, 10 MiB decoded cap — the same limit as `create-ydoc`), decoded,
   diffed through yhub's compute pool and appended to the room's stream —
   attributed to the `system` identity with a `migration=s3` custom
   attribution. This completes before the websocket upgrade resolves, so the
   initial sync always includes the seeded content. First access to an
   unmigrated document is therefore slower by one S3 round-trip plus one
   compute pass.

   **A seed carries no timestamp.** Its contentmap has `insert`/`delete` and
   `migration=s3` but deliberately no `insertAt`/`deleteAt`: a lazy seed is not
   an editing event, and the only honest timestamps for legacy content are the
   S3 version times that the full migration writes. Stamping the seed too would
   put a second `insertAt` on the same ids — persisted contentmaps are merged,
   not de-duplicated — and `activity` would report whichever the (unordered)
   row scan happened to put last. The practical consequence: seeded content
   produces **no `activity` entry** and is skipped by `from`/`to`-filtered
   `changeset`/`rollback`/`prune` queries until the full migration supplies the
   real history. Unfiltered queries, `by=system` and
   `withCustomAttributions=migration:s3` still match it.
3. Concurrent first-connections are collapsed: an in-process in-flight map, a
   per-room valkey lock (`{prefix}:softmigrate:*`, 30 s TTL), and a cap of 20
   concurrent seeds per replica (excess connections fail fast and retry).

Guarantees and failure behavior:

- **Missing S3 object is not an error** — that is the brand-new-document case
  (Django writes no object until the first content save); the room simply
  starts empty.
- **Seeding never decides access** — the backend's answer does. What a failure
  changes is only what the room contains, and the two kinds are treated
  differently (yhub 0.5.0 error semantics):
  - **The legacy object cannot be migrated** — it does not decode, or it
    exceeds the size we will load. Retrying cannot change that, and nobody can
    repair the object from the outside, so refusing would make the document
    permanently unopenable. It opens as a *new* document instead. The cause is
    logged once per attempt (`seed.failed`, with the bucket, key and stack) and
    every subsequent access logs a `seed.skipped` warning, because the caller
    is now editing beside legacy content that stayed behind in S3.
  - **Everything else** — network error, timeout, seed backpressure, and every
    way S3 can refuse (`AccessDenied` on a rotated key, `NoSuchBucket` on a
    misconfigured name, a region redirect). The same request later may well
    succeed, so it answers `503` and clients retry with backoff.

  The split is deliberately asymmetric: only a failure raised while
  *interpreting bytes we already hold* counts as permanent, and it is marked as
  such at the throw site. Everything else is retryable by default. An allowlist
  of retryable errors would have to enumerate every way the store can say no,
  and each case it missed would be read as "this document has no content" and
  open the room empty over content that is alive in S3 — one misscoped
  credential would fork the corpus. Guessing wrong this way costs a retry;
  guessing wrong the other way costs the document.

  A cached failure verdict prevents retry storms from hammering S3 — permanent
  failures (corrupt/oversized objects) for 5 minutes, transient ones (network
  errors, timeouts) for 15 seconds, and per-replica seed backpressure (more
  than 20 concurrent seeds) is not cached at all, so the client's next retry
  goes through.
- **Seeding is idempotent**: the legacy S3 snapshots are frozen (the
  frontend no longer PATCHes content snapshots to Django) and share one Yjs
  lineage with everything in yhub, so duplicate or concurrent seeds merge as
  CRDT no-ops. Losing valkey before compaction merely makes the next access
  re-seed from S3. Note that edits made *after* a document was migrated live
  only in yhub — a re-seed after total yhub data loss restores the
  pre-migration snapshot, nothing newer.
- **`SOFT_MIGRATION=false` does not undo anything** — migrated documents
  stay correct in yhub — but since the frontend's client-side seeding was
  removed along with the content GET/PATCH endpoints, an unmigrated legacy
  document then opens as an *empty* room. Keep the flag on until a backfill
  has migrated the full corpus.

Configuration: `AWS_S3_ENDPOINT_URL`, `AWS_S3_ACCESS_KEY_ID`,
`AWS_S3_SECRET_ACCESS_KEY` (both with `*_FILE` indirection), optional
`AWS_S3_REGION_NAME`, and `AWS_STORAGE_BUCKET_NAME` (defaults to Django's dev
default `impress-media-storage`; production uses a different bucket name and
must set it explicitly). The server refuses to boot when the flag is set
without endpoint and credentials. In development the values arrive via
`env.d/development/common`.

Operational notes:

- Use **read-only, bucket-scoped S3 credentials** in production — never the
  backend's read-write keys; this process terminates untrusted traffic. On
  AWS the credentials must include `s3:ListBucket` on the bucket in addition
  to `s3:GetObject`: without it, S3 reports a missing object as
  `403 AccessDenied` instead of `404 NoSuchKey`, and every brand-new document
  would fail closed instead of starting empty.
- `AWS_S3_ENDPOINT_URL` must not contain a path (the minio client cannot
  address a base path); the server refuses to boot otherwise.
- After manually wiping a room's yhub state (postgres row + stream key),
  **restart yhub** so the in-process verdict cache cannot serve a stale
  "exists" and suppress the re-seed.
- Lazy migration never finishes on its own: documents that are never opened
  stay in S3 forever, and they are only reachable through this flag now that
  the frontend's client-side seeding is gone. Running `migrate` (below) over
  the corpus is the intended completion path. Only after that backfill may
  `SOFT_MIGRATION` be turned off.

## Full migration (`POST /collaboration/migrate/v1/{org}/{docid}`)

The media bucket is versioned, so `{docid}/file` keeps every snapshot Django
ever wrote — that is the version history the backend exposes at
`/documents/{id}/versions/`. The lazy seed above replays only the newest one, so
a soft-migrated document lands in yhub as a single `system` change stamped with
the migration time and its past is gone.

`migrate` replays the whole history instead. It lists the object's versions and
applies them, oldest first, to a single `Y.Doc({ gc: false })`; after each one
it credits the ids that version introduced (and the ones it deleted) with
**that version's own S3 timestamp**. `GET
/collaboration/activity/v1/{org}/{docid}?group=false` then reports one entry per
S3 version, at the same timestamps the backend's version listing reports as
`last_modified` — which is what lines the two up. (Pass `group=false`: the
default grouping merges changes by the same author less than a second apart,
which would fold versions saved in quick succession into one entry.)
`gc: false` is what preserves content that later versions deleted — most of
what makes a history worth keeping.

Since yhub 0.5.0 the built-in endpoints also speak JSON on request, so a
non-JavaScript caller can read that timeline without a lib0 decoder: send
`Accept: application/json` and `activity`/`changeset` answer
`application/json` (binary fields base64-encoded) instead of
`application/x-lib0any`.

The result lands as **one new row in `yhub_ydoc_v1` at clock `0`**, written
through `yhub.persistence.store`. Nothing is deleted and nothing goes on the
redis stream: the migration is purely additive. Clock `0` is what makes that
safe —

- `store` is `ON CONFLICT (org, docid, branch, t) DO NOTHING`, so a repeated or
  concurrent call is a database no-op;
- `retrieveDoc` derives the room's `lastClock` from the *newest* row, so a `0`
  row can never hide stream messages a live editor is writing;
- the history genuinely is the oldest thing in the room.

The next compact task merges that row into the room's normal state and deletes
it, like any other row — yhub needs no special case for it.

Called with the admin JWT (`aud: "yhub"`), doc-scoped, `branch=main` only (the
legacy store is branchless). Running it over the whole corpus — any 2xx means
done — is the backfill that finishes the migration.

Guarantees:

- **Idempotent, twice over.** The docid is recorded in the valkey set
  `{prefix}:migrated:v1` and skipped on later calls; and even without that, the
  `t = 0` insert is a no-op. There is no lock: concurrent calls for the same
  document all succeed and the database keeps one row.
- **Never destructive.** No existing row, stream message or attribution is
  removed, so a document's own yhub history — edits made after it was seeded —
  survives untouched alongside the imported one.
- **Nothing usable, nothing touched, nothing remembered.** A document with no
  legacy object (`versions: 0`) or with no readable version (`applied: 0`) is
  left exactly as it is and is *not* added to the set, so a later run can still
  pick it up. Both answer `200 {"migrated": false}`, so a backfill driver can
  treat every 2xx as done.
- **A corrupt version is skipped, not fatal** (counted as `skipped`, logged with
  its version id). Snapshots are decoded before they are applied, so a bad one
  can neither corrupt the accumulating document nor kill a compute worker.
  Later versions are full snapshots, so their content still arrives — only that
  one timeline entry is lost.
- **More than 500 versions**: only the newest 500 are replayed and the rest fold
  into the first replayed version, reported as `dropped`.

Response (200): `{ status, message, migrated, versions, applied, skipped,
dropped, bytes, durationMs }`. `status` is the machine-readable outcome a
backfill driver records — `ok`, `already`, `empty` (no legacy object, a
brand-new document) or `nothing` (versions exist, none readable) — all of them
done, which is why they share one 2xx. `migrated` says whether this very call
wrote the history.

Caveats:

- **`?force=true` re-runs a document that is already in the set.** Only safe
  while its clock-0 row is still there. Once compaction has folded that row
  away, a forced re-run inserts a second contentmap for ids that already carry
  one, both `insertAt` values survive the merge, and the activity timestamp for
  that content becomes whichever the unordered row scan puts last. To genuinely
  redo a document, wipe its yhub state first (rows, stream key, set member).
- **The replay runs on the server's main thread.** yhub's compute pool only
  accepts its own fixed task types, so a very long history briefly blocks the
  event loop; that is what the 500-version cap bounds.
- **`activity` and `changeset` responses are cached for ~5s** (yhub's
  `redis.cacheTtl`). A call made right after a migration can still answer with
  the pre-migration timeline; it resolves itself.
- Requires `SOFT_MIGRATION=true` (that is what configures the S3 client);
  otherwise it answers `503`.

## ⚠️ License warning (AGPL)

This directory depends on `@y/hub`, which is licensed under the
**GNU AGPL-3.0** (or a separate proprietary license from its author). Unlike
the rest of this repository (MIT), the code in this directory is loaded into
the same process as AGPL-licensed code. As a consequence:

- **Any modification to the code in this directory (in particular `server.js`
  and `migration.js`) must be released under an AGPL-compatible license** if
  you run or distribute the resulting server, including making it available to
  users over a network (AGPL section 13).
- See the [LICENSE](./LICENSE) file in this directory for details.

**The rest of La Suite Docs is not affected.** The Django backend and the
frontend never link against yhub; they communicate with it exclusively
through network requests (REST/HTTP and WebSocket). They remain under the
MIT license of the repository root.
