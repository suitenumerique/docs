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
  `application/octet-stream` — no lib0 encoding, unlike yhub's built-in
  `PATCH .../ydoc/`), so the Django backend can create documents
  server-side. Strict create: 409 when the document already has content.
  Guarded by standard document write access (the admin JWT, or a user
  session with update ability),
- exposes `POST /collaboration/migrate/v1/{org}/{docid}`, which replays a
  document's **full** legacy version history out of the S3 media bucket (see
  "Full migration" below) — admin JWT only, like `reset-connections`,
- mirrors the environment conventions used elsewhere in this repository
  (`*_FILE` secret indirection, `COLLABORATION_SERVER_ORIGIN` allowlist, …).

Public exposure: route the whole `/collaboration/` prefix to this server —
the websocket and the built-in document APIs (`ydoc`, `rollback`, `prune`,
`changeset`, `activity`) are all guarded by the same cookie-based document
authorization and are meant to be reachable by browsers. The one exception
is `/collaboration/reset-connections/` and `/collaboration/migrate/`, which are
backend-internal and should not be routed through the public ingress.

The `Dockerfile` builds the container image used by the `yhub` service in
`compose.yml`.

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

Response (200): `{ migrated, versions, applied, skipped, dropped, bytes,
durationMs }`.

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
