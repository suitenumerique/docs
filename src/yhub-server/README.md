# yhub-server

This directory contains the La Suite Docs-specific configuration for
[yhub](https://www.npmjs.com/package/@y/hub) (`@y/hub`), the collaboration
server that synchronizes Yjs documents between editors in real time.

It is not a fork of yhub — it is a thin wrapper (`server.js`) that:

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
- mirrors the environment conventions used elsewhere in this repository
  (`*_FILE` secret indirection, `COLLABORATION_SERVER_ORIGIN` allowlist, …).

Public exposure: route the whole `/collaboration/` prefix to this server —
the websocket and the built-in document APIs (`ydoc`, `rollback`, `prune`,
`changeset`, `activity`) are all guarded by the same cookie-based document
authorization and are meant to be reachable by browsers. The one exception
is `/collaboration/reset-connections/`, which is backend-internal and should
not be routed through the public ingress.

The `Dockerfile` builds the container image used by the `yhub` service in
`compose.yml`.

## Soft migration (`SOFT_MIGRATION=true`)

Documents were historically stored by the Django backend in the S3 media
bucket, as UTF-8 text that is the base64 encoding of a raw Yjs update, at key
`{document-uuid}/file`. With `SOFT_MIGRATION=true`, this server migrates those
documents into yhub lazily, on first access:

1. After a user's document authorization succeeds, the auth plugin checks
   whether yhub already has content for the room — a bare postgres `SELECT`
   (persisted rows), then the valkey stream (uncompacted `ydoc:update:v1`
   messages), then the `SELECT` again to close the compaction race. Verdicts
   are cached in-process (existing docs 10 min, empty docs 60 s, failures
   5 min).
2. If the room is unknown, the legacy object is fetched from S3 (10 s
   timeout, 10 MiB decoded cap — the same limit as `create-ydoc`), decoded,
   diffed through yhub's compute pool and appended to the room's stream —
   attributed to the `system` identity with a `migration=s3` custom
   attribution. This completes before the websocket upgrade resolves, so the
   initial sync always includes the seeded content. First access to an
   unmigrated document is therefore slower by one S3 round-trip plus one
   compute pass.
3. Concurrent first-connections are collapsed: an in-process in-flight map, a
   per-room valkey lock (`{prefix}:softmigrate:*`, 30 s TTL), and a cap of 4
   concurrent seeds per replica (excess connections fail fast and retry).

Guarantees and failure behavior:

- **Missing S3 object is not an error** — that is the brand-new-document case
  (Django writes no object until the first content save); the room simply
  starts empty.
- **Everything else fails closed**: network/auth errors, timeouts, oversized
  objects and corrupt updates deny the connection (an opaque 401 the client
  retries with backoff) and log a `soft-migration` error. A cached failure
  verdict prevents retry storms from hammering S3 — permanent failures
  (corrupt/oversized objects) for 5 minutes, transient ones (network errors,
  timeouts) for 15 seconds, and per-replica seed backpressure (more than 4
  concurrent seeds) is denied without caching so the client's next retry goes
  through.
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
  the frontend's client-side seeding is gone. A batch backfill (Django
  posting each document's **exact** S3 bytes to `create-ydoc` with the admin
  JWT, treating 409 as success) is the intended completion path and composes
  safely with concurrent first-accesses — as long as content is never
  re-converted: independently generated updates for the same document would
  duplicate its content on merge, while re-posting the stored bytes is a
  no-op. Only after the backfill may `SOFT_MIGRATION` be turned off.

## ⚠️ License warning (AGPL)

This directory depends on `@y/hub`, which is licensed under the
**GNU AGPL-3.0** (or a separate proprietary license from its author). Unlike
the rest of this repository (MIT), the code in this directory is loaded into
the same process as AGPL-licensed code. As a consequence:

- **Any modification to the code in this directory (in particular
  `server.js`) must be released under an AGPL-compatible license** if you run
  or distribute the resulting server, including making it available to users
  over a network (AGPL section 13).
- See the [LICENSE](./LICENSE) file in this directory for details.

**The rest of La Suite Docs is not affected.** The Django backend and the
frontend never link against yhub; they communicate with it exclusively
through network requests (REST/HTTP and WebSocket). They remain under the
MIT license of the repository root.
