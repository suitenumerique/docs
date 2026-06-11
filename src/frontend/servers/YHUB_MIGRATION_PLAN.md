# Collaboration server migration: y-provider (Hocuspocus) → yhub (@y/hub)

> Status: **implemented (Phase 1)** — plan written and executed 2026-06-10, against
> `@y/hub@0.2.22`.
> Scope: a brand-new collaboration server in `src/frontend/servers/yhub`, replacing the
> realtime part of `src/frontend/servers/y-provider`. The conversion endpoint
> (`POST /api/convert/`) is **out of scope**: it stays in y-provider and will be moved to a
> dedicated application later.
>
> Implementation status:
> - Step 0 spike **passed 13/13** (yjs-13 ↔ @y/y-14-rc round-trip incl. incremental
>   merges/gc/state-vectors/PG path; purge primitive; HTTP-level auth rejection).
> - Server implemented in `servers/yhub` (44 unit + 2 integration tests, lint/build clean).
> - Frontend swapped to `y-websocket` (tsc/eslint clean, 250 impress tests pass).
> - Infra done: Dockerfile (node:22-trixie-slim, `yarn cache clean` in install layers),
>   compose (`yhub-development` on :4444, redis:7, y-provider keeps the converter role),
>   e2e compose (`yhub` + `y-provider-converter`), Makefile targets, nginx prod
>   dual-location template, docker-hub/ghcr publish jobs, `uws` lockfile entry switched
>   to git+https (CI-friendly).
> - Remaining: full-stack Playwright e2e run; production rollout per §3.12; Phase 2
>   (server-side write-back) is unstarted by design.

Hard constraints driving every decision below:

1. **Django is the source of truth.** Documents are saved through its API
   (`/api/v1.0/documents/{id}/content/`). The collaboration server must never silently
   override Django.
2. **WebSocket access is optional.** Users behind WS-blocking proxies must keep full
   read/write capability by talking to Django directly (this is today's behavior and it
   must survive the migration unchanged).
3. **Authentication = user cookies** on the WebSocket upgrade. Fetching
   `GET /api/v1.0/documents/{document_id}/` with the forwarded cookies returns the user's
   `abilities` on the document, which determine access (`retrieve` → may connect,
   `update` → read-write vs read-only).

---

## Part 1 — Analysis of the existing y-provider server

### 1.1 Topology

```
                    ┌────────────────────────────────────────────┐
 Browser            │ y-provider (Express 5 + express-ws, :4444) │
 (HocuspocusProvider│                                            │
  + BlockNote)      │  /collaboration/ws/   → Hocuspocus 3.4.4   │
 ───────────────────▶  (in-memory Y.Doc rooms, NO persistence)   │
        │           │  /collaboration/api/* → mgmt endpoints     │
        │           │  /api/convert/        → BlockNote convert  │
        │           └───────────────┬────────────────────────────┘
        │                           │ GET /documents/{id}/ , /users/me/
        │ PATCH …/content/          │ (forwarded cookies + X-Y-Provider-Key)
        ▼                           ▼
 ┌─────────────────────────────────────────┐
 │ Django backend (source of truth, S3)    │──▶ reset-connections / get-connections
 └─────────────────────────────────────────┘        (Bearer COLLABORATION_SERVER_SECRET)
```

The single most important property: **y-provider is a stateless relay.** Hocuspocus is
configured with no `onLoadDocument`, no `onStoreDocument`, no database/redis extensions
(`src/servers/hocuspocusServer.ts`). A room's Y.Doc lives only in process memory and is
destroyed when the last client disconnects. All persistence is **browser-driven** (§1.4).

### 1.2 HTTP/WS surface

| Route | Auth | Purpose |
|---|---|---|
| `WS /collaboration/ws/?room={uuid}` | Origin allow-list + cookies required (`wsSecurity` middleware, closes `4001` without cookies) | Hocuspocus protocol relay |
| `POST /collaboration/api/reset-connections/?room={uuid}` (+ optional `x-user-id` header) | `Authorization: Bearer <COLLABORATION_SERVER_SECRET>` | Kick all connections of a room, or only one user's. Called by Django on permission changes |
| `GET /collaboration/api/get-connections/?room={uuid}&sessionKey={key}` | same Bearer | Returns `{ "count": <non-readOnly connections>, "exists": <sessionKey present?> }`. Used by Django's save arbitration |
| `POST /api/convert/` | API key | Markdown/BlockNote/Yjs/HTML conversion — **out of scope here** |
| `GET /ping` | none | health check |

### 1.3 Connection & auth flow (`onConnect`, `src/servers/hocuspocusServer.ts`)

1. `room` query param must equal the Hocuspocus `documentName` and be a valid UUID,
   otherwise the connection is rejected.
2. `GET {COLLABORATION_BACKEND_BASE_URL}/api/v1.0/documents/{room}/` with forwarded
   `Cookie` + `Origin` headers plus `X-Y-Provider-Key: <Y_PROVIDER_API_KEY>`
   (`src/api/collaborationBackend.ts`).
   - `!abilities.retrieve` or backend error → reject.
   - `connectionConfig.readOnly = !abilities.update`.
3. `docs_sessionid` cookie value is kept as `context.sessionKey` (consumed by
   get-connections).
4. `GET /api/v1.0/users/me/` → `context.userId`; failures are swallowed (anonymous users
   on public docs are legitimate).

### 1.4 Document lifecycle and persistence (browser-driven)

- **Load**: the frontend fetches the document from Django; `content` is a base64-encoded
  Yjs update applied locally (`Y.applyUpdate(doc, Buffer.from(content, 'base64'))`,
  `useProviderStore.tsx`). When the provider then syncs with the (possibly empty)
  Hocuspocus room, CRDT merge seeds the room from the browser.
- **Save**: `useSaveDoc.tsx` PATCHes `/api/v1.0/documents/{id}/content/` with
  `{ content: <base64 yjs update>, websocket: <provider connected?> }` every 60 s, on
  unload and on route change. Local-only transactions trigger saves; remote-origin
  updates do not.
- **WS-blocked fallback** (constraint 2): exactly the same code path — the user loads
  from Django, edits alone, saves to Django with `websocket: false`.
- **Save arbitration**: when `COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = true`, Django
  rejects `websocket: false` saves unless `_can_user_edit_document()` passes — which
  queries y-provider's get-connections endpoint (`viewsets.py:803`, content PATCH at
  `viewsets.py:2022-2085`).

### 1.5 Django → y-provider calls

`core/services/collaboration_services.py` (`Authorization: Bearer
COLLABORATION_SERVER_SECRET`):

- `reset_connections(room, user_id=None)` — called when the link configuration changes
  (`viewsets.py:1799`) and when a document access is updated/deleted
  (`viewsets.py:2811`, `2832`). This is the **security mechanism** that revokes live
  write access; without it a revoked user keeps an open socket.
- `get_document_connection_info(room, session_key)` — the `{count, exists}` contract of
  §1.2.

There is **no content-rewind hook**: Django never tells y-provider "the stored content
was replaced". Today that's harmless because rooms are forgotten as soon as they empty.

### 1.6 Configuration (`src/env.ts`)

`PORT` (4444), `COLLABORATION_LOGGING`, `COLLABORATION_SERVER_ORIGIN` (comma-separated
allow-list), `COLLABORATION_SERVER_SECRET[_FILE]`, `Y_PROVIDER_API_KEY[_FILE]`,
`COLLABORATION_BACKEND_BASE_URL` (default `http://app-dev:8000`), `SENTRY_DSN`,
`CONVERSION_FILE_MAX_SIZE` (convert only).

### 1.7 Deployment

- Docker: `node:22-alpine`, multi-stage (deps → development → builder → final), port 4444.
- nginx production template
  (`docker/files/production/etc/nginx/conf.d/default.conf.template`):
  `/collaboration/ws/` (Upgrade headers, 86400 s read/send timeouts) and
  `/collaboration/api/` both proxy to `${YPROVIDER_HOST}:4444`.
- Dev `compose.yml`: `y-provider-development` plus a **separate**
  `y-provider-development-converter` service (conversion is already isolated at the
  deployment level — convenient for our scope cut).
- No Redis, no horizontal scaling: every instance has private in-memory rooms, so
  reset-/get-connections are only correct with a single replica (or sticky routing).

---

## Part 2 — Analysis of @y/hub

### 2.1 What it is

`@y/hub` 0.2.22 (Kevin Jahns, Yjs author) is a **y-websocket-compatible collaboration
backend** designed for horizontal scalability. Beta software, dual-licensed
**AGPL-3.0**/proprietary (AGPL accepted for this project). ESM-only, Node ≥ 22.
Notable deps: `@y/y@14-rc` (yjs v14 line with attributions), `redis@5` client,
`postgres`, `minio`, `uws` (uWebSockets.js — **glibc-only prebuilds**, no musl/Alpine).

```
 Clients (y-websocket) ◀──▶ Server (uws)  ◀──▶ Redis (streams + pub/sub)
                                  │                  │
                                  ▼                  ▼
                            PostgreSQL ◀──────── Worker (compaction)
                            (metadata + blobs)   [+ S3 for blobs, optional]
```

Unlike Hocuspocus, the server keeps **no Y.Doc in memory** after the initial sync: client
updates are appended to a per-room Redis stream (`{prefix}:room:{org}:{docid}:{branch}`)
and fanned out to subscribers; a background **worker** periodically merges
stream backlog into PostgreSQL (table `yhub_ydoc_v1`) and trims Redis. Any number of
servers/workers can share one Redis+PG — no coordination needed.

### 2.2 Setup API

```ts
import { createYHub } from '@y/hub'

const yhub = await createYHub({
  redis: { url, prefix, taskDebounce /*10s*/, minMessageLifetime /*60s*/ },
  postgres: 'postgres://…',           // REQUIRED
  persistence: [],                    // [] is valid: blobs stored inline in PG bytea
  server: { port, auth, maxDocSize } | null,   // uws WS+REST server (optional)
  worker: { taskConcurrency } | null,          // compaction worker (auto-started)
})
```

`persistence` is a plugin chain (`{init?, store?, retrieve?, delete?}`); the bundled
`S3PersistenceV1` (`@y/hub/plugins/s3`) offloads blobs to S3 — with an empty chain
everything lives inline in Postgres, which is the right starting footprint here.

### 2.3 Protocol & client

The WS endpoint `GET /ws/{org}/{docid}` speaks the **standard y-websocket wire protocol**
(messageSync 0 with syncStep1/2/update, messageAwareness 1). On open the server sends
syncStep1(state-vector) + syncStep2(full doc) + current awareness. Messages from
read-only clients are **silently dropped** server-side. Browsers use the stock
`y-websocket` `WebsocketProvider` — not HocuspocusProvider (different framing).

### 2.4 Auth model

```ts
type AuthPlugin<AuthInfo extends { userid: string }> = {
  readAuthInfo(req: uws.HttpRequest): Promise<AuthInfo>           // identify
  getAccessType(authInfo, room: {org,docid,branch}): Promise<'rw'|'r'|null>  // authorize
}
```

The README examples are JWT-based, but the interface is generic: `readAuthInfo` receives
the raw upgrade request and `AuthInfo` may carry arbitrary claims through to
`getAccessType`. **uws constraint**: the `HttpRequest` is only valid synchronously —
query/headers must be read *before the first `await`* (the upstream `upgrade` handler
awaits `readAuthInfo`, so this is on the plugin author).

### 2.5 In-process core APIs (what embedding buys us)

- `yhub.getDoc(room, include)` — merged doc (all PG rows + Redis backlog).
- `yhub.unsafePersistDoc(room, update, {by})` — direct persist, stamped `<ms>-I`.
  **Append+merge semantics, not replace** — it cannot rewind a room.
- `yhub.stream.addMessage(room, msg)` — inject updates/awareness into the live stream.
- `yhub.persistence.retrieveDoc(room, {references: true})` +
  `yhub.persistence.deleteReferences(refs)` — row deletion; this is the **purge
  primitive** (it's what worker compaction uses to replace rows).
- `yhub.computePool` — merge/state-vector/changeset/rollback computations.

REST endpoints also exist on the uws server (`GET/PATCH /ydoc/{org}/{docid}`,
`/rollback`, `/changeset`, `/activity`) with lib0-binary (not JSON) bodies, behind the
same auth plugin.

### 2.6 Gaps & constraints relevant to docs

| Gap / constraint | Impact |
|---|---|
| **No connection registry, kick, or count API** ("kick users when permissions change" is on the README's missing-features list) | Django's reset-connections and get-connections contracts cannot be served by stock @y/hub — we must own the client sockets (gateway, §3.2) |
| **Durable room state** (Redis+PG) vs Hocuspocus amnesia | Stale cache can resurrect content after an out-of-band Django change (restore/import). Needs an invalidation strategy (§3.5) |
| Merge-only persistence — no rewind primitive | "Django wins" requires actual row deletion + stream trim, not `unsafePersistDoc` |
| ESM-only; package `exports` allow only `.` and `./plugins/s3` | New server must be ESM; no reaching into internals like `protocol.js` |
| `uws` glibc-only | Docker base `node:22-trixie-slim` (glibc ≥ 2.38), **not** alpine or Debian ≤ 12 |
| Redis ≥ 6.2 required (`XAUTOCLAIM` for worker task claiming) | Dev compose runs `redis:5` — must upgrade |
| `@y/y@14-rc` server-side vs `yjs` 13 in the browser | Wire compatibility is the design intent ("y-websocket compatible") but must be **proven by a spike before anything else** (§3.10 step 0) |
| Beta (0.2.x), CORS hardcoded `*` on its REST API | Pin the exact version; keep the uws server internal-only |

---

## Part 3 — Migration plan

### 3.1 Decisions (settled)

1. **Phased, cache-first save model.**
   *Phase 1*: browsers keep saving to Django exactly as today (`useSaveDoc` untouched);
   yhub's Redis+PG state is a **disposable cache**, purged when a room goes from 0 to 1
   connections. This reproduces Hocuspocus semantics (fresh room per session, re-seeded
   from Django by the first browser) with **zero Django changes** and a trivial rollback
   story. *Phase 2* (outline in §3.12): server-side write-back to Django + ETag
   reconcile, demoting browser saves to the WS-blocked fallback.
2. **WS-blocked users: unchanged** — load + save via Django, no live collaboration, no
   new transport.
3. **Gateway + embedded yhub, single Node process.** An Express gateway on :4444 owns
   authentication (cookies → Django abilities), the client sockets (→ kick & count), and
   the management API; the stock `@y/hub` uws server runs in-process on an internal port
   and is reached through a localhost WS byte-pipe. Stock yhub behavior is preserved
   (easy upgrades through the 0.2.x churn); the cost is one loopback hop.

### 3.2 Target topology

```
            :4444 (the only published port)
 ┌──────────────────────────────────────────────────────────────────┐
 │ yhub server process (TS, ESM, Node 22)                           │
 │                                                                  │
 │  Express gateway                       embedded @y/hub           │
 │  ├ GET  /ping                          ├ uws WS  :4445 /ws/docs/{id}
 │  ├ POST /collaboration/api/reset-connections/   (internal only)  │
 │  ├ GET  /collaboration/api/get-connections/     ├ worker (compaction)
 │  └ WS   /collaboration/ws/{room}                └ core APIs      │
 │       │ 1 cookie+origin guard                        ▲           │
 │       │ 2 Django abilities check                     │ purge /   │
 │       │ 3 purge-on-0→1 + register          in-process│ getDoc    │
 │       │ 4 mint one-time token                        │           │
 │       └ 5 ws://127.0.0.1:4445/ws/docs/{room}?yauth=token ─ pipe ─┘
 └──────────────┬───────────────────────────────┬───────────────────┘
                │                               │
            Redis ≥ 7 (streams, registry,    PostgreSQL
            kick pub/sub)                    (yhub_ydoc_v1, blobs inline)
```

Room addressing is fixed: `org = 'docs'`, `branch = 'main'`, `docid = <document uuid>`.

### 3.3 Connection flow (replaces `onConnect`)

On `GET /collaboration/ws/{room}` upgrade (raw `http` `upgrade` event + `ws`
`WebSocketServer({noServer: true})` — **not** express-ws, so failures are real HTTP
status codes *before* the 101, which y-websocket treats as `connection-error` with
backoff):

1. `room` must be a UUID → else `400`. Origin in `COLLABORATION_SERVER_ORIGIN` → else
   `403`. Cookie header present → else `401`.
2. Django auth — direct port of y-provider's logic (§1.3), same headers
   (`Cookie`, `Origin`, `X-Y-Provider-Key`): `!abilities.retrieve` → `403`;
   `canEdit = abilities.update`; `users/me` → `userId` (anonymous fallback
   `anon:<random>` — @y/hub requires a `userid` string for attributions);
   `docs_sessionid` → `sessionKey`.
3. `ensureFreshRoomAndRegister(room, conn)` — §3.5.
4. `issueToken({userid, room, canEdit})` — single-use, in-process `Map`, TTL 10 s
   (gateway and yhub share the process: no HMAC, no Redis, no double Django fetch).
5. Dial `ws://127.0.0.1:${YHUB_INTERNAL_PORT}/ws/docs/${room}?yauth=${token}`; on
   upstream open, `wss.handleUpgrade(...)` and start the **byte pipe** (both legs speak
   y-websocket framing; the gateway never decodes — read-only enforcement stays inside
   yhub). Either side closing closes the other and deregisters. A
   `bufferedAmount > 8 MiB` guard terminates slow consumers.

The yhub auth plugin is then trivial — and immune to the uws sync constraint because the
token lookup is synchronous:

```ts
const authPlugin = {
  readAuthInfo(req) {
    // uws req is only valid synchronously — read the query before any await
    const token = new URLSearchParams(req.getQuery() ?? '').get('yauth')
    const claims = token && consumeToken(token)   // sync Map lookup, deletes on read
    if (!claims) throw new Error('invalid internal token')
    return Promise.resolve(claims)                // {userid, room, canEdit}
  },
  getAccessType(auth, room) {
    if (room.org !== 'docs' || room.branch !== 'main' || room.docid !== auth.room)
      return Promise.resolve(null)                // token is room-bound
    return Promise.resolve(auth.canEdit ? 'rw' : 'r')
  },
}
```

### 3.4 Connection registry, kick, count (Django contracts preserved verbatim)

- Local `Map<room, Set<Conn>>` holding both sockets per connection
  (`{id, userId, sessionKey, canEdit, client, upstream}`).
- Shared state in Redis (own client, *not* yhub's): one key per connection
  `{prefix}:gw:conn:{room}:{connId}` → `{userId, sessionKey, canEdit, instanceId}`, with
  `EX CONN_TTL_SECONDS` (30) refreshed by a 10 s heartbeat — instance crashes self-clean
  within the TTL. Room listing = `SCAN MATCH {prefix}:gw:conn:{room}:*` + `MGET`.
- `GET /collaboration/api/get-connections/?room&sessionKey` (Bearer secret):
  `{ count: entries.filter(e => e.canEdit).length, exists: entries.some(e => e.sessionKey === sessionKey) }`
  — byte-for-byte the y-provider contract.
- `POST /collaboration/api/reset-connections/?room` (+ optional `x-user-id`):
  `PUBLISH {prefix}:gw:kick {room, userId?}`; **every** gateway instance closes its
  matching local client sockets with code `4000`. A kicked client auto-reconnects and
  re-runs gateway auth — which is exactly what Django wants when permissions changed.
  Multi-instance correct by construction (y-provider never was).

### 3.5 Purge on 0→1 (the disposable-cache mechanism)

```ts
async function ensureFreshRoomAndRegister(room: string, conn: Conn) {
  await withRedisLock(`${prefix}:gw:purgelock:${room}`, 5_000, async () => {
    if ((await registry.listRoom(room)).length === 0) {
      const r = { org: 'docs', docid: room, branch: 'main' }
      const { references } = await yhub.persistence.retrieveDoc(r, { references: true })
      if (references?.length) await yhub.persistence.deleteReferences(references) // PG rows
      await redis.del(`${YHUB_REDIS_PREFIX}:room:docs:${room}:main`)              // stream
    }
    await registry.register(conn)  // inside the lock: concurrent joiners serialize;
  })                               // the second joiner sees count=1 and skips the purge
}
```

Why this is safe:

- A room idle longer than `taskDebounce` has **no pending compaction tasks** (tasks are
  only created by update activity), so purging an idle room cannot race the worker.
- *Race A — rejoin within the debounce window*: an in-flight compaction may re-insert a
  row post-purge. Benign: same Y.Doc lineage, CRDT-merges cleanly with the rejoining
  client's Django-seeded state.
- *Race B — instance crash*: ghost registry keys make the room look occupied for ≤ 30 s,
  so a join skips the purge and resumes the cache. Same benign-merge argument.
- The sharp edge for both races: a Django **content rewind** (version restore, import)
  inside that small window could be partially resurrected. See risk #6 (§3.13) — the
  mitigation is having Django call reset-connections on restore, which is advisable
  today already.

Seeding needs no server code: like with Hocuspocus, the first browser arrives with the
Django content already applied locally and pushes it as a regular update after sync.

### 3.6 New server layout (`src/frontend/servers/yhub/`)

Mirrors y-provider conventions (tsconfig/vitest/eslint/nodemon copied; same `@/*` alias,
same `_FILE` secret pattern, same logger style).

```
package.json            "type": "module"; deps: @y/hub 0.2.22 (PINNED), express 5.2.1,
                        ws ^8, axios 1.16.1, redis ^5, cors 2.8.6, @sentry/node;
                        devDeps += y-websocket + yjs + y-protocols (test clients)
Dockerfile              node:22-trixie-slim (uws needs glibc ≥ 2.38 — never alpine), y-provider stages
src/
  env.ts                config (§3.7)
  routes.ts             route constants
  middlewares.ts        Bearer-secret check (port of httpSecurity)
  helpers.ts            logger, isUuid, cookie parsing
  start-server.ts       boot: sentry → redis clients → createYHub → heartbeat/kick sub
                        → http listen :4444; SIGTERM: close clients (1001), deregister
  api/collaborationBackend.ts      fetchDocument / fetchCurrentUser (port)
  servers/appServer.ts             express app + http server + upgrade hook
  servers/yhubServer.ts            createYHub from env (persistence: [], worker on)
  handlers/collaborationUpgradeHandler.ts   §3.3
  handlers/wsPipe.ts                        byte relay + lifecycle
  handlers/resetConnectionsHandler.ts       §3.4
  handlers/getConnectionsHandler.ts         §3.4
  yhubauth/internalToken.ts        issue/consume one-time tokens
  yhubauth/authPlugin.ts           §3.3
  registry/connectionRegistry.ts   §3.4
  registry/kickChannel.ts          §3.4
  rooms/roomLifecycle.ts           §3.5
  services/sentry.ts               copy
__tests__/              unit + integration/ (§3.11)
```

### 3.7 Environment variables

Carried over unchanged (drop-in for deploy tooling): `PORT` (4444),
`COLLABORATION_LOGGING`, `COLLABORATION_SERVER_ORIGIN`,
`COLLABORATION_SERVER_SECRET[_FILE]`, `Y_PROVIDER_API_KEY[_FILE]`,
`COLLABORATION_BACKEND_BASE_URL`, `SENTRY_DSN`.

New:

| Var | Default | Purpose |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379` | yhub streams + registry + kick pub/sub |
| `POSTGRES_URL` | dev: the impress PG | yhub persistence (`yhub_ydoc_v1`) |
| `YHUB_REDIS_PREFIX` | `yhub` | namespaces streams and gateway keys |
| `YHUB_INTERNAL_PORT` | `4445` | embedded uws server — never published |
| `YHUB_TASK_DEBOUNCE` / `YHUB_MIN_MESSAGE_LIFETIME` / `YHUB_TASK_CONCURRENCY` / `YHUB_MAX_DOC_SIZE` | lib defaults | @y/hub tuning passthrough |
| `CONN_TTL_SECONDS` / `CONN_HEARTBEAT_SECONDS` | `30` / `10` | registry liveness |
| `AUTH_TOKEN_TTL_MS` | `10000` | internal one-time token TTL |

### 3.8 Frontend changes (`apps/impress`)

1. `package.json`: add `y-websocket`; remove `@hocuspocus/provider` once imports are gone
   (`yjs` and `y-protocols 1.0.7` already present).
2. `useCollaborationUrl.tsx`: return `{serverUrl, roomname}`. `serverUrl =
   (conf?.COLLABORATION_WS_URL || wss://host/collaboration/ws/).replace(/\/+$/, '')` —
   stripping the trailing slash keeps existing `COLLABORATION_WS_URL` deployment values
   valid, since `WebsocketProvider` builds `serverUrl + '/' + roomname` →
   `/collaboration/ws/{uuid}` (the `?room=` form disappears).
3. `useProviderStore.tsx`: `HocuspocusProvider` → `new WebsocketProvider(serverUrl,
   documentId, doc)`. Event mapping:
   - `status` → `isConnected`; first `connected` ⇒ `isReady` (gateway authenticates
     *before* the handshake, so connected implies authenticated — no `onAuthenticated`).
   - `sync` → `isSynced` + `isReady`.
   - `connection-close` code `4000` (kick) → let the built-in reconnect re-auth; keep the
     jittered `hasLostConnection` signal.
   - `connection-error` (failed handshake = our 4xx) → after N (≈3) consecutive
     failures, `provider.disconnect()` and `{isReady: true, isConnected: false}` —
     replaces the Hocuspocus `4001 "no cookies"` clean-close branch.
   - Inactivity pause/resume → `provider.disconnect()` / `provider.connect()`.
   - Drop most custom reconnect code (y-websocket has built-in backoff).
4. `useCollaboration.tsx`: adapt `createProvider` signature/types; logic is
   provider-agnostic.
5. Sweep `grep -rn 'HocuspocusProvider\|@hocuspocus' src/` — BlockNote wiring only needs
   `provider.awareness` + the Y.Doc, both present on `WebsocketProvider`.
6. **`useSaveDoc.tsx`: untouched** (primary save in Phase 1, WS-blocked fallback forever).

### 3.9 Infra changes

- **compose.yml**: `redis:5` → `redis:7` + healthcheck (verify Django cache/celery
  against 7 in the spike); new `yhub-development` service cloned from
  `y-provider-development` (build `servers/yhub/Dockerfile`, `depends_on` redis+pg
  healthy; side-by-side on host port `4453`, swapped to `4444` at switchover). Dev
  reuses the `postgresql:16` impress DB (`yhub_ydoc_v1` is namespaced); production
  guidance: dedicated database/instance so cache churn doesn't share Django's DB.
- **Dockerfile**: mirror y-provider's stages on `node:22-trixie-slim`, with a loud comment that
  alpine breaks `uws` at *runtime*, plus the AGPL notice (§3.13 #4).
- **nginx prod template**: introduce `${YHUB_HOST}`; during transition:
  - `location = /collaboration/ws/` (exact: old `?room=` URLs from cached bundles) →
    y-provider;
  - `location ~ ^/collaboration/ws/[0-9a-fA-F-]{36}$` → yhub (same WS headers/timeouts);
  - `location /collaboration/api/` → yhub.
  After fleet convergence, drop the exact-match block.
  Dev nginx has no collaboration block (direct :4444) — no change.
- `env.d/development/common` at switchover:
  `COLLABORATION_API_URL=http://yhub-development:4444/collaboration/api/`,
  `COLLABORATION_WS_URL=ws://localhost:4444/collaboration/ws/`.
  `Y_PROVIDER_API_BASE_URL` (convert) untouched.

### 3.10 Step sequencing (each step independently verifiable)

0. **Compat spike — gate for everything else**: (a) yjs-13 update round-trip through a
   booted `createYHub` (`stream.addMessage` → `getDoc` → re-apply in yjs 13; BlockNote
   fragment `document-store`) — *if the @y/y-14 ↔ yjs-13 binary formats don't round-trip,
   the architecture needs a transcode step and this plan stops here*; (b) redis:7 smoke
   incl. Django; (c) `createYHub` boots in the target container image; (d) observe upgrade-rejection
   statuses and `maxDocSize`-exceeded behavior.
1. Scaffold (`package.json` rewrite to ESM, configs copied, `/ping`, Sentry) — builds,
   starts, pings.
2. `api/collaborationBackend.ts` + unit tests.
3. yhub bootstrap + token store + auth plugin — raw `ws` client with a minted token syncs
   against :4445.
4. Gateway upgrade handler + pipe — y-websocket client end-to-end with a stub Django;
   reject-matrix tests green.
5. Registry + heartbeat + get-connections.
6. Kick pub/sub + reset-connections (two-instance integration test).
7. Purge on 0→1.
8. Dockerfile + compose + redis:7 — manual two-browser collab on the dev stack (:4453).
9. Frontend swap (§3.8).
10. Dev switchover (ports + env) + full Playwright e2e.
11. nginx prod template + rollout/rollback runbook.

### 3.11 Test plan

- **Unit** (vitest, no infra; mirrors y-provider's test files): token store
  (single-use/TTL/room-binding), auth-plugin matrix, registry+lock against a thin redis
  fake, upgrade reject matrix (origin/cookies/uuid → 403/401/400) with mocked backend,
  reset-/get-connections handlers via supertest.
- **Integration** (real redis 7 + PG; compose services locally, service containers in
  CI): two `WebsocketProvider` clients through the gateway (edits + awareness both ways);
  read-only client's edits dropped; purge lifecycle (rows+stream gone on rejoin);
  `{count, exists}` semantics; two-instance kick with code 4000; the step-0 round-trip
  promoted to a permanent test.
- **Acceptance**: existing Playwright e2e suite against the switched dev stack — collab
  editing, permission-revoke kick, `COLLABORATION_WS_NOT_CONNECTED_READY_ONLY` flow,
  saves via `useSaveDoc`.

### 3.12 Rollout & rollback

1. Deploy yhub side-by-side (`YHUB_HOST`), nginx unchanged → zero traffic; smoke-test
   directly.
2. In one window: frontend release (y-websocket), nginx dual-location, and Django
   `COLLABORATION_API_URL` repoint. Stale cached bundles keep hitting y-provider via the
   exact-match location; mixed-fleet exposure (old+new clients on one doc live in
   different relays, both still saving via Django) equals today's provider-outage mode —
   acceptable for a short window.
3. Converge: drop the old WS location. y-provider keeps running **only** for
   `/api/convert/` until conversion moves to its own application.
4. **Rollback at any point** = revert nginx + `COLLABORATION_API_URL` (+ frontend only if
   the client itself misbehaves). No data migration in either direction — the yhub state
   is a disposable cache *by construction*.

**Phase 2 outline (write-back — separate plan, includes Django review):** a
persistence-plugin tap (or compaction hook) PATCHes merged content to Django
(`websocket: true`, `If-Match` on the ETag captured at room start; on 412 merge Django's
content into the room and retry) using service-key trust — a Django change. Purge-on-0→1
becomes ETag-compare-and-reuse. `useSaveDoc` flips to fallback-only while synced.

### 3.13 Risks & open questions

1. **yjs 13 ↔ @y/y 14-rc update compatibility** — existential; gated by step 0. Pin
   `@y/hub@0.2.22` exactly; upgrade deliberately.
2. **uws glibc**: alpine fails at runtime, not build — guard with Dockerfile comment.
3. **Redis ≥ 6.2**: prod deployments on managed Redis 5/6.0 need an upgrade or a
   dedicated instance; the compose bump also moves Django's redis — verified in step 0.
4. **AGPL-3.0** in an MIT repo: network use of the combined yhub service triggers AGPL
   source obligations. Accepted, but add a LICENSE notice in `servers/yhub/` and get
   maintainer sign-off before merge.
5. **y-websocket quirks**: queryAwareness (type 3) isn't answered by yhub (harmless —
   awareness pushed on open); built-in BroadcastChannel tab-sync coexists with
   `useBroadcastStore` — test multi-tab, set `disableBc: true` if artifacts appear.
6. **Purge races vs content rewind** (§3.5): recommend Django also call
   reset-connections on version restore — a small "Phase 1.5" backend nicety, not a
   launch blocker (the same exposure exists today with a connected client).
7. **Pipe backpressure**: the 8 MiB `bufferedAmount` guard is crude; revisit with
   `maxDocSize` tuning for very large docs.
8. **Internal REST surface** (`/ydoc`, `/rollback`, …) on :4445 shares the auth plugin;
   single-use tokens are consumed by the WS upgrade, leaving REST effectively inert —
   verify no anonymous route exists (step 3).
9. **Revoked-access UX timing**: HTTP-level rejection changes when the frontend learns
   it lost access (handshake failure vs Hocuspocus close-after-open) — the N-failures
   heuristic needs e2e validation.
