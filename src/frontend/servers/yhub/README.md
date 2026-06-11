# yhub — docs collaboration server

Realtime collaboration server for docs, built on [`@y/hub`](https://github.com/yjs/yhub)
(see `LICENSE-NOTICE.md` for the AGPL implications). It replaces the realtime part of
`servers/y-provider`; the conversion endpoint (`/api/convert/`) stays in y-provider.

Architecture, rationale and rollout plan: `../YHUB_MIGRATION_PLAN.md`.

## How it works

One Node process containing two layers:

- **Gateway** (Express + raw WebSocket upgrade, port `4444`, the only published port):
  authenticates browsers against Django with their cookies
  (`GET /api/v1.0/documents/{id}/` abilities), keeps the connection registry in Redis
  (kick + count across replicas), purges a room's cached state when its first client
  connects (Django is the source of truth — yhub state is a disposable cache), then
  byte-pipes the WebSocket to the embedded @y/hub server using a single-use token.
- **Embedded @y/hub** (uws server on `YHUB_INTERNAL_PORT`, never published): the actual
  y-websocket relay — Redis streams for fan-out, Postgres (`yhub_ydoc_v1`, blobs inline)
  for spillover persistence, plus the compaction worker.

HTTP surface (contracts identical to y-provider):

| Route | Purpose |
|---|---|
| `WS /collaboration/ws/{room}` | y-websocket endpoint (cookies + allowed origin required) |
| `POST /collaboration/api/reset-connections/?room=` (+ opt. `x-user-id` header) | kick connections (close code `4000`), fanned out to all instances via Redis pub/sub |
| `GET /collaboration/api/get-connections/?room=&sessionKey=` | `{count, exists}` for Django's save arbitration (404 on empty room) |
| `GET /ping` | health check |

## Configuration

Carried over from y-provider: `PORT` (4444), `COLLABORATION_LOGGING`,
`COLLABORATION_SERVER_ORIGIN`, `COLLABORATION_SERVER_SECRET[_FILE]`,
`Y_PROVIDER_API_KEY[_FILE]`, `COLLABORATION_BACKEND_BASE_URL`, `SENTRY_DSN`.

New:

| Variable | Default | Purpose |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379` | streams + registry + kick pub/sub (**Redis ≥ 6.2**) |
| `POSTGRES_URL` | dev impress DB | `yhub_ydoc_v1` table (dedicated DB recommended in production) |
| `YHUB_REDIS_PREFIX` | `yhub` | namespace for all Redis keys |
| `YHUB_INTERNAL_PORT` | `4445` | embedded uws server — never expose it |
| `YHUB_TASK_DEBOUNCE` / `YHUB_MIN_MESSAGE_LIFETIME` / `YHUB_TASK_CONCURRENCY` / `YHUB_MAX_DOC_SIZE` | @y/hub defaults | tuning passthrough |
| `CONN_TTL_SECONDS` / `CONN_HEARTBEAT_SECONDS` | `30` / `10` | registry liveness (crashed instances self-clean) |
| `AUTH_TOKEN_TTL_MS` | `10000` | gateway → embedded-yhub one-time token TTL |

## Develop & test

```bash
yarn dev      # nodemon (build + start)
yarn test     # unit tests (no infrastructure needed)

# integration tests need a real Redis ≥ 7 and PostgreSQL:
docker run -d -p 16379:6379 redis:7
docker run -d -p 15432:5432 -e POSTGRES_USER=yhub -e POSTGRES_PASSWORD=yhub \
  -e POSTGRES_DB=yhub postgres:16-alpine
REDIS_URL=redis://localhost:16379 \
  POSTGRES_URL=postgres://yhub:yhub@localhost:15432/yhub yarn test:integration
```

The Docker image must stay on a glibc ≥ 2.38 base (`node:22-trixie-slim`): `uws`
ships no musl binaries and its glibc builds require 2.38+ — alpine or Debian ≤ 12
fail at runtime, not at build time.
