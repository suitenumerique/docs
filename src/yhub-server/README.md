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
  and PostgreSQL — and, when `YHUB_S3_PERSISTENCE` asks for it, a bucket the
  document blobs are stored in instead of the database, see "Document storage"
  below),
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
  verified against its JWKS (`/api/v1.0/jwks`); this route is named by no
  browser grant, so it is reachable by that admin token alone,
- exposes `POST /collaboration/create-ydoc/v1/{org}/{docid}` (optional
  `X-User-Id` header naming the user the initial content is attributed to),
  which seeds a document's initial Yjs state from a raw binary update
  (`Y.encodeStateAsUpdate` / pycrdt `get_update()` output posted as
  `application/octet-stream`), so the Django backend can create documents
  server-side. The built-in `PATCH .../ydoc/` takes the same update, but this
  one is a **strict create** — 409 when the document already has content — and
  it credits the content to `X-User-Id` instead of to the caller. Admin JWT
  only: it is a backend route, and under yhub 0.7 it was the one custom
  endpoint a signed-in editor could also reach, because it declared no
  `accessPurpose`. Reading goes through the built-in `GET .../ydoc/`, which
  since 0.5.0 answers JSON (the update base64 encoded) to a request sending
  `Accept: application/json`,
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
- answers two probes, unauthenticated like the JWKS and deliberately asking
  different questions:
  - `GET /collaboration/ping/v1` → `200 {"status":"pong"}` without touching
    anything. Being answered at all proves the http channel and the event loop
    are alive, which is as far as a **liveness** check should go: restarting a
    server over a store it cannot reach would drop the websockets it is
    serving perfectly well,
  - `GET /collaboration/ready/v1` → `200 {"status":"ready","checks":{…}}`, or
    `503` with the offending store marked `unreachable`, after asking postgres
    (`SELECT 1`) and redis (`PING`) in parallel, each with a two second
    budget. A **readiness** failure takes the pod out of the service endpoints
    and leaves its siblings serving. The body names the store but never the
    error: the route is public, and a postgres client will happily put its
    connection string in the message it raises — that goes to the log instead,
- mirrors the environment conventions used elsewhere in this repository
  (`*_FILE` secret indirection, `COLLABORATION_SERVER_ORIGIN` allowlist, …).

Public exposure: the browser needs the websocket `/collaboration/ws/`,
`/collaboration/ydoc/` for the http fallback, `/collaboration/activity/` and
`/collaboration/changeset/` for the editing history, plus
`/collaboration/jwks/v1`, which carries public keys and nothing else. Every
other route this server serves — `rollback`, `prune`, `reset-connections`,
`migrate`, `create-ydoc`, `restore-ydoc`, `reset-ydoc` — is refused to a browser
by the permission tables themselves (see "Access control" below), so publishing
one is no longer the security boundary it was under yhub 0.7. Keep them off the
public ingress all the same: an endpoint that cannot be reached cannot be
probed. The two probes are not worth publishing either — kubelet calls them from
inside — and the helm chart's ingress lists what it routes rather than what it
hides, so they stay in-cluster on their own.

### Access control

yhub 0.8 replaced the `'r' | 'rw' | null` access vocabulary with **permission
objects**: the auth plugin answers, per facet, what a subject may do with one
document, and yhub enforces every facet itself — on the websocket and on the
REST routes alike. Docs' whole policy is three tables in `permissions.js`, kept
out of `server.js` so they can be read and tested without redis and postgres.
`permissions.test.js` asks them the same questions yhub's gates ask; run it with
`npm test`.

Masks are positional `crud` strings where `-` denies, so `'-r--'` is read-only.

| Facet | Reader | Editor | Link-only reader | Admin token |
|---|---|---|---|---|
| `ydoc` | `-r--` | `-ru-` | as reader/editor | `cru-` |
| `awareness` | `-r--` | `-ru-` | as reader/editor | `-ru-` |
| `history` | `from: <access date>` | `from: <access date>` | — | `from: 0` |
| `delete` | — | — | — | `['soft']` |
| `endpoint.ws` | `-r--` | `-ru-` | as reader/editor | `crud` (`'*'`) |
| `endpoint.ydoc` | `-r--` | `-ru-` | as reader/editor | `crud` (`'*'`) |
| `endpoint.activity` | `-r--` | `-r--` | — | `crud` (`'*'`) |
| `endpoint.changeset` | `-r--` | `-r--` | — | `crud` (`'*'`) |
| every other endpoint | — | — | — | `crud` (`'*'`) |

All three browser columns are the same document permission,
`browserDocumentPermissions`, switched on two things the backend sends:
`abilities.update` for reader-vs-editor, and `user_access_since` for whether
there is a history to read. `abilities.retrieve` decided whether there is any
access at all before either.

Five of those cells are decisions rather than transcriptions:

- **`awareness: '-r--'` for a reader.** A reader receives presence and never
  publishes it — [suitenumerique/docs#2544](https://github.com/suitenumerique/docs/pull/2544),
  where a read-only connection was found to still propagate cursors even though
  its document updates were dropped. yhub enforces it on both transports: it
  drops a read-only connection's awareness message on the socket, and refuses the
  `awareness` field of `PATCH /ydoc`. This is a deliberate departure from yhub's
  own default, which grants a reader `'-ru-'` and documents read-only cursors as
  a feature. The frontend has to know it too: the http fallback provider has no
  receive-only setting, so a reader's `HttpProvider` is built with no awareness
  instance at all, or its first `PATCH` would take a 403 and close it for good.
- **No `'*'` endpoint fallback for the browser.** Only the four routes above are
  named, so everything else is denied — including any endpoint a future yhub
  release adds. Under 0.7 this fence was a `purpose != null` check, which
  `create-ydoc` slipped through by declaring no purpose.
- **`history.from` is the moment the user got access**, not the beginning of the
  document. It is the backend's `user_access_since` — the earliest access they
  hold on the document or on one of its ancestors — and it is the same rule the
  version endpoints have always applied ("only those created after the user got
  access to the document"). yhub clamps `from` up to it on every
  `activity`/`changeset` read, so a client asks for whatever range it likes and
  gets back only its own share: the bound is silent, enforced server-side, and a
  stale client cannot widen it. Two properties fall out of it and are worth
  keeping true:
  - a **`gc=false` connection stays refused**, because that requires
    `from === 0` exactly and a real access date never is;
  - the ray is a **stored** bound (`DocumentAccess.created_at`), not a
    wall-clock-relative one, which is what yhub's determinism contract asks for —
    it re-derives identically on every websocket recheck instead of flapping the
    connection.
- **A reader who holds no access, only the link, gets no history.** There is no
  access row and so no date; the backend has always refused those users their
  version history for exactly that reason ("we wouldn't know from which date to
  allow them anyway"). `activity` and `changeset` are withheld together with the
  ray rather than granted alone, which would open a route that answers 403 by
  itself. `rollback` and `prune` are withheld from everyone: they are
  destructive and are granted by name.
- **`delete: ['soft']` and not `'hard'` for the admin.** yhub 0.8 made
  `DELETE /ydoc?hard=true` reachable over REST for the first time. Docs keeps
  irreversible erasure programmatic, behind `reset-ydoc` (see "Deletion").

Identity is separate from permission. `authenticate` establishes who is asking;
returning `null` there means *anonymous*, not *denied*, so every rejection in
this server is a thrown `apiError(401, …)`. An unauthenticated visitor is given
the userid `anonymous`, which is what lets them edit a public document at all:
yhub refuses the upgrade of a caller that holds the write but has no identity,
because attributions carry the userid. Every anonymous edit is therefore
attributed to that one shared author.

### Origins and cors

`COLLABORATION_SERVER_ORIGIN` is the list of origins a browser may reach this
server from, and it is passed to yhub as its `cors` configuration: yhub applies
it to the websocket upgrade *and* to every REST route, refusing a cross-origin
request from anywhere else with a `403` before authentication runs. A request
carrying no `Origin` at all is same-origin or is not a browser, and is gated by
the session cookie alone — which is why `authenticate` no longer checks the
origin itself: doing it twice would refuse exactly the requests the http
fallback makes, since a same-origin `fetch` GET sends no `Origin` header.

`credentials: true` goes with it, so that browsers may send the session cookie
on a cross-origin request. That is what the frontend's http fallback
(`@y/yhub-http-fallback`, which polls `GET`/`PATCH /collaboration/ydoc/v1/…`
when a network refuses the websocket upgrade) needs, and it is also why the
list has to be concrete: browsers reject `Access-Control-Allow-Credentials`
together with a wildcard origin. Entries are bare origins —
`https://host[:port]`, no path, no trailing slash — or yhub refuses them at
startup.

## Roles (`YHUB_ROLE`)

yhub is two halves that share the two stores and nothing else — no in-process
state, no ordering between them:

- the **server** accepts the websocket connections, serves the routes above,
  and writes every update to the redis stream,
- the **worker** claims tasks from that stream, merges the updates and stores
  the result in postgres, then trims what it persisted.

One process runs both, which is the default and what `YHUB_ROLE` unset means.
Setting it splits them, so each can be scaled on its own — the server with the
connected editors, the worker with the write throughput:

| `YHUB_ROLE` | websocket + routes | drains the stream |
| ----------- | ------------------ | ----------------- |
| unset, `all` | yes | yes |
| `server`     | yes | no  |
| `worker`     | no  | yes |

A `worker` process binds no port: no probes to give it and no service to put in
front of it. A `server` process claims no task, so a deployment of servers
alone accepts edits and never persists them — the two halves are split
together or not at all. Any other value is refused at startup rather than
guessed.

Redis consumer groups hand each task to exactly one worker, so the number of
workers is a throughput knob and nothing else: no leader, no partitioning, no
coordination between them.

`YHUB_TASK_CONCURRENCY` is the other half of that knob — see below.

## Tuning

Three numbers this wrapper passes to yhub, all of them environment variables
whose defaults are what Docs ran with before they were configurable:

| Variable | Default | What it changes |
| -------- | ------- | --------------- |
| `YHUB_TASK_CONCURRENCY` | `5` | Tasks one worker process claims at once |
| `YHUB_TASK_DEBOUNCE_MS` | `10000` | How long an update waits on the stream before a worker persists it |
| `YHUB_MIN_MESSAGE_LIFETIME_MS` | `60000` | How long persisted updates stay replayable from redis |

**Concurrency** multiplies with the number of processes running a worker, since
redis hands each task to exactly one of them: the two are interchangeable up to
the point where a pod runs out of memory, each task holding the document it
merges.

**The debounce** is the delay between an edit and its row in postgres, and the
window over which the edits of a busy document are merged into a single task.
Lowering it persists sooner and compacts more often; raising it does the
reverse. yhub's own default is 120s, which is a long time to lose when a pod is
killed, hence the 10s here.

**The message lifetime** is not a durability setting: the trim stops at the
older of that age and the point postgres already holds, so nothing unpersisted
is ever dropped. It buys how much recent history a server can replay from redis
instead of reading the document back out of postgres, and it is paid for in
redis memory.

All three are refused at startup, like an unknown role, when they are not whole
numbers in range (`YHUB_TASK_CONCURRENCY must be an integer >= 1 (got "abc")`):
`Number()` would otherwise read a typo as `NaN` and hand it to yhub, which
takes it — a worker that claims nothing, or a stream that is never trimmed,
with nothing in the logs to say so. Unset and empty both mean the default, so a
kubernetes variable left blank behaves as if it were absent. The effective
values are logged at startup, next to the role:

```json
{"role":"all","server":true,"worker":true,"taskConcurrency":5,"s3Bucket":null,"taskDebounceMs":10000,"minMessageLifetimeMs":60000,"msg":"yhub configuration"}
```

## Document storage (`YHUB_S3_PERSISTENCE`)

Every compaction writes one row in `yhub_ydoc_v1`, and that row carries four
blobs: the garbage-collected document, the one that keeps its history, the
content map and the content ids. By default they are `bytea` columns — the
whole corpus lives on the database disk, which is the configuration Docs has
been running and what this server does when nothing below is set.

`YHUB_S3_PERSISTENCE=true` plugs yhub's own S3 persistence plugin
(`S3PersistenceV1`, shipped with `@y/hub`) into the chain it consults before
writing a blob and before reading one back. The blobs then go to a bucket and
the row keeps a reference to them, `<column>_is_reference` saying which of the
four it is: postgres holds the index of the documents, the bucket holds their
bytes.

| Variable | Required | What it is |
| -------- | -------- | ---------- |
| `YHUB_S3_PERSISTENCE` | — | `true` to store the blobs in a bucket (default: postgres) |
| `YHUB_S3_ENDPOINT_URL` | yes | Endpoint of that bucket, without a path (e.g. `https://s3.example.com`) |
| `YHUB_S3_ACCESS_KEY_ID` | yes | Key with read, write and delete on the bucket (or `…_FILE`) |
| `YHUB_S3_SECRET_ACCESS_KEY` | yes | Secret of that key (or `…_FILE`) |
| `YHUB_S3_BUCKET_NAME` | yes | Name of the bucket. No default: a typo would create one |
| `YHUB_S3_REGION_NAME` | no | Region, when the provider needs one told rather than discovered |

"Required" means required *when the plugin is on*: it is a startup error naming
what is missing, rather than a client that ends up anonymous and only says so
on the first compaction — which is a background task, so the failure would show
up as documents quietly not being persisted. The bucket in use is logged next
to the role (`"s3Bucket":"yhub-storage"`, `null` for postgres).

This is a **third** bucket, and it is deliberately configured apart from the
other two: the backend's media bucket (`AWS_S3_*`, Django's own settings) and
the legacy document store the migrations read (`LEGACY_S3_*`, see below). They
may sit on three providers with three sets of credentials, and each is read by
the process it belongs to.

A few things worth knowing before turning it on:

- **It cannot be turned back off.** A row pointing at an object is unreadable
  without the plugin that wrote it, and yhub reports such a version as having
  no content rather than as an error — so a document compacted while the plugin
  was on comes back *empty* once it is off, silently. Turning it on is safe in
  the other direction: rows written before keep their bytes inline and are
  served exactly as they were,
- **the bucket is created at startup** when it does not exist, so the
  credentials need `HeadBucket` and, the first time, `CreateBucket`. It is
  checked on every boot, which is also what makes a wrong endpoint or a wrong
  key fail loudly and immediately,
- **both halves need it.** The worker writes the blobs and the server reads
  them back, so a split deployment (`YHUB_ROLE`) configures the bucket on both
  — in the helm chart the worker inherits `yhub.envVars`, so there is nothing
  to repeat,
- **only the `main` branch is offloaded.** The plugin declines everything else
  and those blobs stay in postgres, which is yhub's behaviour, not a setting,
- **objects are deleted late.** When a version's row is dropped (pruning, a
  reset, a hard deletion), the object is removed about ten seconds later, so
  that readers holding the reference are not left with a 404. A delete that
  fails is logged and forgotten: the bucket may accumulate objects no row names
  anymore, and nothing collects them,
- the objects are Yjs blobs keyed by
  `id:ydoc:v1/{org}/{docid}/{branch}/{gc}/{clock}` (and `id:contentmap:v1/…`,
  `id:contentids:v1/…`) — one object per version and per column, not one file
  per document, and **not** a format anything but yhub reads. It is a storage
  backend, not an export and not a backup.

In the dev stack the variables are in `env.d/development/yhub`, pointing at the
same minio the rest of the stack uses with a bucket of its own
(`yhub-storage`), and the toggle is off. Flipping it to `true` and restarting
the service is enough to exercise the path — on a dev database, where losing
the documents already compacted costs nothing.

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

Erasing the content for good is a third operation (`YHub.deleteDoc(docRef, {
hard: true })`). yhub 0.8 exposes it over REST as `DELETE .../ydoc?hard=true`,
gated by the `delete` facet — and the admin token is granted `['soft']` only, so
in Docs that request is refused and the erasure stays reachable from inside this
process alone, through `reset-ydoc` below. It is not what deleting a document in
Docs does: a soft-deleted one simply stops being restorable after
`TRASHBIN_CUTOFF_DAYS`, and its content is kept. Note that a hard deletion is
final for that room — the docid can never be written again, and `restore-ydoc`
answers 409 for it.

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
2. If the room is unknown, the legacy object is fetched from S3 whole,
   whatever its size (10 s timeout for the request and its body), decoded,
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
  failures (objects that do not decode) for 5 minutes, transient ones (network
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

Configuration: `LEGACY_S3_ENDPOINT_URL`, `LEGACY_S3_ACCESS_KEY_ID`,
`LEGACY_S3_SECRET_ACCESS_KEY` (both with `*_FILE` indirection), optional
`LEGACY_S3_REGION_NAME` (`us-east-1` when unset, which every S3-compatible
provider answers to), `LEGACY_S3_SIGNATURE_VERSION` (see below), and
`LEGACY_S3_BUCKET_NAME` (defaults to Django's dev default
`impress-media-storage`; production uses a different bucket name and must set
it explicitly). The server refuses to boot when the flag is set without
endpoint and credentials. In development they come, like everything else this
server reads, from `env.d/development/yhub` (and `yhub.local`, which is not
committed — `make create-env-local-files` creates it).

The bucket is read with the **AWS SDK for JavaScript v3**
(`@aws-sdk/client-s3`), the same library family boto3 is to Django, so the
provider quirks the backend already deals with apply here too. Two settings
follow from that:

- `LEGACY_S3_SIGNATURE_VERSION` — the counterpart of Django's
  `AWS_S3_SIGNATURE_VERSION`, since a provider expecting the other signature
  answers `403`, which reads exactly like wrong credentials. It defaults to
  `s3v4` and accepts `s3v4` or `v4`. **SigV2 (boto3's `s3`) is not available**:
  the AWS SDK v3 dropped it, so asking for it fails at boot instead of signing
  the other way and being bounced,
- addressing style is chosen from the endpoint: path style (`{host}/{bucket}`)
  everywhere but `amazonaws.com`, which prefers virtual-host style. Self-hosted
  providers have no per-bucket DNS record, so path style is what they need.

The prefix is deliberate: these name **the bucket this server migrates out
of**, which is the backend's media bucket and not the one yhub will persist
into once the S3 persistence plugin is enabled. That one gets a set of its own,
and the two are free to be different buckets, on different providers, with
different credentials. Nothing here reads the backend's `AWS_S3_*` settings —
a pod that carries them, for the backend's own reasons, must not quietly
migrate documents out of whatever they point at.

Operational notes:

- Use **read-only, bucket-scoped S3 credentials** in production — never the
  backend's read-write keys; this process terminates untrusted traffic. On
  AWS the credentials must include `s3:ListBucket` on the bucket in addition
  to `s3:GetObject`: without it, S3 reports a missing object as
  `403 AccessDenied` instead of `404 NoSuchKey`, and every brand-new document
  would fail closed instead of starting empty.
- `LEGACY_S3_ENDPOINT_URL` must not contain a path (the minio client cannot
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
