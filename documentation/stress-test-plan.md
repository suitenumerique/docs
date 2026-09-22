# Stress test plan — yhub architecture (next major release)

Status: plan, written 2026-09-18 from a code read of branch `yhub`. Nothing in
here has been run yet. File and line references are valid for that branch at
that date; re-check them before relying on them.

## Goal

Determine whether the new architecture (Django backend + `yhub-server` built on
`@y/hub`, Valkey streams, Postgres persistence) scales, and find where it stops
scaling, before the release reaches production.

Environment: preprod, loaded with an anonymized copy of the production database
on which the full migration has been run, so that the volumetry is realistic.

Deliverable: a capacity table (sockets per yhub pod, connects per second per
backend pod, edits per second per yhub worker, migrated documents per hour)
that tells how to size production and where autoscaling makes sense.

## Architecture facts that shape the tests

Collaboration path:

- The browser uses plain `y-websocket` `WebsocketProvider`
  (`src/frontend/apps/impress/src/features/docs/doc-management/stores/useProviderStore.tsx:154-160`)
  with `disableBc: true`, `maxBackoffTime: 30000`, `resyncInterval: 20000`.
  Wire protocol is y-protocols sync + awareness.
- WS URL: `wss://{host}/collaboration/ws/v1/docs/{docid}`. The doc id must be a
  lowercase uuid4, the org must be `docs`.
- HTTP fallback on the same rooms (`@y/yhub-http-fallback`), about one poll
  every 10 s, only while the socket is down.
- Authentication of the WS upgrade is the Django session cookie, forwarded by
  yhub to the backend. There is no `collaboration-auth` ingress subrequest
  anymore.
- Every WS connect, reconnect and fallback request triggers 2 to 3 Django
  calls from yhub: `GET /users/me/` (`src/yhub-server/src/server.ts:190`),
  `GET /documents/{id}/` (`:252`), and `GET /documents/{id}/accesses/me/` when
  the user can list versions (`:279`).
- `backendFetch` in yhub has no timeout and no retry
  (`src/yhub-server/src/backend.ts:116-139`). A failure gives a 503, which
  `y-websocket` retries forever.
- yhub pods are stateless, cross-pod fan-out goes through Valkey, there are no
  sticky sessions (`upstream-hash-by` was removed on purpose).
- A worker drains the Valkey stream into Postgres. Throughput is
  `YHUB_TASK_CONCURRENCY` (default 5) times worker replicas, debounce
  `YHUB_TASK_DEBOUNCE_MS` 10000.
- Each compaction fires `POST /documents/{id}/content-updated/` on Django
  (5 s timeout, not awaited). Django updates the row and triggers the search
  indexer, which calls `get_ydoc` back on yhub. This is a feedback loop.

Backend:

- The Django to yhub client opens a new connection per call, with no
  `requests.Session`, no retry, 30 s timeout
  (`src/backend/core/services/yhub_services.py:196-229`).
- Synchronous yhub calls inside HTTP requests: document creation from a file,
  `duplicate` (2 round-trips per node, inside `transaction.atomic`),
  `formatted-content` (yhub + converter), `create-for-owner`, first login with
  the onboarding sandbox document.
- Asynchronous (Celery): delete, restore and access changes walk the whole
  subtree with one HTTP call per node. Single default queue, 1 worker replica.
- No `CONN_MAX_AGE`. The psycopg pool exists but is off by default
  (`DB_PSYCOPG_POOL_ENABLED`).
- uvicorn, `WEB_CONCURRENCY=4`, `--limit-max-requests=20000`.
- Sessions are cache-backed (`SESSION_ENGINE = cache`).
- DRF throttles: 80/min per user on documents, 50/min on document accesses.
  yhub is exempt through `X-Y-Provider-Key`.

Migration:

- One cheap Django migration (`0034_documentmigration`).
- `migrate_documents`: thread pool, `--concurrency` default 2, `--rate`,
  `--limit`, resumable and idempotent.
- `SOFT_MIGRATION=true`: unmigrated documents are seeded on first open, inside
  the WS upgrade handler. Each replica runs at most `MAX_CONCURRENT_SEEDS=20`
  seeds at once and fails fast beyond that: the caller gets a 503 and relies
  on the client's retry backoff, it is not queued. A 30 s Redis lock
  serialises seeds of the same document across replicas
  (`src/yhub-server/src/migration.ts:63-64`, `:419-429`).
- `generate_volumetry` writes no document content. Only `create_demo` and
  `migrate_documents` put content in yhub.

Deployment (`src/helm`):

- No HPA anywhere, `resources: {}` on every impress container, static replicas
  (backend 3, yhub 3, yhub worker disabled by default, Celery 1).
- When this plan was written there was no metrics endpoint in Django or yhub
  (done since, see sections 0.1 and 0.2).
- Valkey is not deployed from this repository on real clusters: another team
  runs it, through the valkey operator (Sentinel mode), one instance for the
  backend (`valkey-docs`: cache, sessions, Celery) and one for yhub
  (`valkey-yhub`). In this repository, dev and feature only run two standalone
  instances from the `valkey/valkey` chart
  (`src/helm/env.d/{env}/values.valkey.yaml.gotmpl`), with
  `maxmemory-policy volatile-lru`. Stream entries without a TTL cannot be
  evicted under that policy, so the memory limit of `valkey-yhub` matters.
- The only nginx auth subrequest left is `media-auth`.

Frontend:

- On connection loss, each client waits up to 3 s of jitter, then refetches
  `GET /documents/{id}/`.
- The service worker `SyncManager` replays queued mutations with no backoff
  and no jitter
  (`src/frontend/apps/impress/src/features/service-worker/SyncManager.ts:17-45`).

## 0. Prerequisites

Without metrics a test only shows that something broke, not where. Real
clusters are synced by Argo CD and there is no kubectl access, so dashboards
are the only way to observe a run. Everything below ships through git and
helm values.

First question to settle with the ops team: what scrapes metrics in preprod
(Prometheus operator with ServiceMonitor and PodMonitor, or annotation-based
scraping) and where dashboards live. The chart work depends on the answer.

### 0.1 yhub-server

**Implemented** (2026-09-18): metrics and Sentry. See the "Metrics" and "Error
reporting" sections of `src/yhub-server/README.md`.

- `PROMETHEUS_METRICS_ENABLED=true` and `PROMETHEUS_API_KEY` (required) start
  a listener on its own port (`9464`) in every role, the worker included. It
  answers one path to a bearer token, like the backend's `/metrics`.
- Chart: `yhub.metrics.enabled`. `serviceMonitor.enabled` or
  `podMonitor.enabled` then scrapes every pod from inside the cluster (one
  monitor per component, `backend.metrics.enabled` for the backend); the
  dedicated `ingressMetrics` publishes `/metrics/yhub` and
  `/metrics/yhub-worker` next to the backend's `/metrics` for a Prometheus
  outside of it.
- `@y/hub` 0.9.0 owns the uWebSockets server and has no hook on socket open,
  close or message. What is measured is what our code and its public events
  allow:

  | Metric | What to watch during a run |
  |---|---|
  | `yhub_ws_connections`, `yhub_rooms` | sockets and open documents per replica (read off `stream.subs`, an internal of yhub) |
  | `yhub_auth_duration_seconds{phase,endpoint,result}` | cost of admitting a caller: upgrades, rechecks, fallback polls. `result="unavailable"` is a 503 sent to the client |
  | `yhub_backend_request_duration_seconds{route,status}`, `yhub_backend_requests_inflight{route}` | the 2 to 3 Django calls per connect. Inflight is what piles up when Django slows down, since `backendFetch` has no timeout |
  | `yhub_worker_pending_tasks` | compaction backlog for the whole deployment: use `max`, not `sum` |
  | `yhub_worker_task_duration_seconds`, `yhub_worker_tasks_inflight` | worker saturation against `YHUB_TASK_CONCURRENCY` |
  | `yhub_doc_updates_total` | rate of `content-updated` notifications sent to Django |
  | `yhub_seed_duration_seconds`, `yhub_seeds_inflight`, `yhub_seed_rejected_total` | soft migration under load, and the opens refused at 20 concurrent seeds |
  | `nodejs_eventloop_lag_seconds` | the first signal of a saturated replica: one thread serves all its sockets |

- Not visible from inside yhub: messages and bytes per socket, close codes,
  Postgres pool state. Read them from the Valkey exporter, ingress-nginx and
  `pg_stat_activity` on the `yhub` database.
- Logs: `@y/hub` logs every socket connect and close at info level. Check the
  log pipeline can take it at 10k sockets.
- Sentry: `error` and `fatal` log lines are reported. The refusal of a seed at
  20 concurrent ones is logged at error level (`seed.failed`), so the soft
  migration scenario will send one Sentry event per refused open. Lower that
  log line to `warn`, or expect the volume.

Decision still to take before the first storm scenario: `backendFetch` has no
timeout. Either leave it as is for the first run, to measure the real
behaviour, or add `AbortSignal.timeout` first.

### 0.2 Django backend

1. Request and SQL metrics: **implemented** (2026-09-18), see
   `documentation/metrics.md`. `django-prometheus` is opt-in
   (`PROMETHEUS_METRICS_ENABLED`), labels are view name, method and status.
   - Served on `/metrics` (not under `/api/`), behind a bearer token
     (`PROMETHEUS_API_KEY`, required) checked by the first middleware. The
     chart has a dedicated `ingressMetrics`, to be filtered by address.
   - The uvicorn workers share their numbers through a local directory
     (multiprocess mode, required with `WEB_CONCURRENCY=4`), defaulted so that
     nothing has to be configured.
   - Scraping through the ingress reaches a different pod each time. Every
     sample has a `hostname` label so the replicas stay apart, but each series
     is only sampled one scrape out of N. For the load test, with many backend
     pods, prefer scraping each pod from inside the cluster if preprod allows
     it; otherwise use a short scrape interval and 5 min rate windows.
   - Known limit: workers recycled by `--limit-max-requests=20000` leave
     their files behind, so the directory grows until the pod is replaced.
     Watch `scrape_duration_seconds` during the soak scenario.
2. Custom metrics on the known pressure points: **implemented**
   (2026-09-21), see `documentation/metrics.md`.
   - `docs_outgoing_request_duration_seconds{service,operation,method,status}`
     and `docs_outgoing_requests_inflight`: the calls to yhub
     (`YHubService.request`) and to the two converters, timeouts told apart
     from errors;
   - `docs_db_pool_*`: state and exact counters of the psycopg pool when
     `DB_PSYCOPG_POOL_ENABLED` is on. `requests_queued_total` and
     `requests_wait_seconds_total` are the signal that was missing in the
     2026-08-18 and 2026-09-07 outages;
   - `docs_celery_queue_length`: backlog of the single default queue the
     subtree cascades land on (use `max`, not `sum`);
   - not done: Celery task duration by task name. The workers serve no
     endpoint, so it needs either a pushgateway or the multiprocess directory
     shared with a small exporter.
3. Query-level detail: silk is already wired. Enable it in preprod with
   `SILKY_INTERCEPT_PERCENT` at 1 to 2 % and run `purge_silk_profiles`
   between runs. Set `SENTRY_TRACES_SAMPLE_RATE` (default 0.0,
   `settings.py:532`) to about 0.01 if Sentry is available in preprod, for
   traces across Django, Celery and outgoing HTTP calls.
4. Request logs: keep `LOGGING_LEVEL_REQUEST_SUMMARY` on, the dockerflow
   summary carries the path, status and duration of every request and is the
   fallback when a metric is missing.
5. Configuration parity with production: `DB_PSYCOPG_POOL_*`, pooler,
   `WEB_CONCURRENCY`, cache and session Valkey settings, Celery concurrency,
   throttle rates. Disable outgoing emails, PostHog, AI and webhooks.

### 0.3 Synthetic sessions

**Implemented** (2026-09-21) as a dedicated Django application,
`src/backend/loadtest/`, that only the `LoadTest` configuration installs.

Why it is needed: authentication is session-only
(`DEFAULT_AUTHENTICATION_CLASSES` holds only `SessionAuthentication`) and the
Keycloak realm has 4 static users, so load clients cannot log in through OIDC at
scale. Sessions are cache-backed, `MIDDLEWARE` contains no OIDC token-refresh
middleware, and yhub forwards the same cookie to `/users/me/`, so a session
written straight to the store covers HTTP, WS and the HTTP fallback.

How it is kept out of production:

- `LOAD_TEST_TOOLS_ENABLED` is `False` in `Base`, pinned to `False` again in
  `Production` (which `Feature`, `Staging`, `PreProduction` and `Demo` inherit),
  and is not read from the environment: no variable can turn it on.
- `class LoadTest(Production)` is the only configuration that sets it to `True`
  and adds `loadtest` to `INSTALLED_APPS`. Everywhere else the commands do not
  exist (`Unknown command`).
- The application refuses to load when the setting is off, so adding it to
  another configuration stops the process from starting.
- The commands check the setting again, and refuse the `Production`
  configuration by name.

Usage, in preprod: deploy the backend with `DJANGO_CONFIGURATION=LoadTest`,
then run the commands through the chart's generic backend job (Argo CD
`PostSync` hook, `backend.job.command`):

```bash
python manage.py create_load_test_sessions 5000 --heaviest 50 \
    --storage-name campaign-1.json --ttl-hours 8
python manage.py revoke_load_test_sessions --storage-name campaign-1.json
```

- Users: active, not staff, not superuser, with at least one access to a live
  document. `--heaviest N` takes the N users holding the most accesses, the
  rest is a random draw. Staff are excluded because a minted session of theirs
  would open the admin.
- Manifest (JSON): `cookie_name`, `expires_at`, `public_documents`, and per
  session `user_id`, `session_key`, `editable_documents`,
  `readonly_documents` (most recently updated first, `--documents-per-user`
  each). This is what the swarm and k6 read to open documents they are allowed
  to open.
- The manifest holds live cookies and is a secret. It goes to a `0600` file
  (`--output`) or to a private object under `loadtest/` in the default storage
  (`--storage-name`), never to stdout or logs. The media route only serves
  `{document id}/attachments/…` keys, so that prefix cannot be fetched through
  `/media/`. The load generator needs read access to that object.
- Revocation reads an index kept next to the sessions, so it works without the
  manifest and across several runs. Sessions live 12 h by default, 7 days at
  most.

Rules for the load clients:

- One distinct user per virtual client, otherwise the per-user DRF throttles
  (80/min on documents) distort results. Keep the throttles on, they are part
  of production behaviour.
- Keep the cookie jar. `ForceSessionMiddleware` creates a 12 h session in
  Valkey for every request that carries none.
- Team-based accesses are not listed in the manifest, only direct ones.
- `documents/search/` refreshes the OIDC token when
  `OIDC_STORE_REFRESH_TOKEN` is on: minted sessions hold no token, so leave
  that endpoint out of the scenarios or keep the setting off in preprod.

### 0.4 Chart and infrastructure

- Done in the chart: the metrics of the backend, of yhub and of its worker
  are served behind a bearer token, and `ingressMetrics` publishes them on a
  dedicated host (`/metrics`, `/metrics/yhub`, `/metrics/yhub-worker`), to be
  filtered by address. Through an ingress each scrape reaches one replica at
  random: if the preprod Prometheus runs inside the cluster, scraping each pod
  directly (ServiceMonitor and PodMonitor carrying the token) gives better data
  with many replicas, and would be a chart addition.
- Valkey, to ask the team that runs it (it is not managed from this
  repository): the exporter enabled on `valkey-docs` and `valkey-yhub`, their
  metrics in the same Prometheus, and the memory limit and `maxmemory-policy` of
  each instance in preprod and in production.
- Postgres: pghero or `pg_stat_statements`, connection counts per database
  and per application name, replication and failover state.
- ingress-nginx metrics: request rate, latency, active connections, per
  ingress.
- Pod CPU, memory, restarts and throttling for every component, load
  generators included.
- Preprod matches production on replicas, resource requests and limits,
  Postgres pooler, Valkey memory and eviction policy for `valkey-docs` and
  `valkey-yhub`, yhub worker replicas and `YHUB_TASK_CONCURRENCY`. If preprod
  differs from production, results are only relative.

### 0.5 Dashboards

One board per question, built before the first run:

- users: `canary_page_open_seconds`, `canary_editor_ready_seconds`,
  `canary_propagation_seconds`, `canary_failures_total{step}` (from
  `src/loadtest/canary/`);
- yhub: sockets and rooms per pod, event-loop lag, auth duration, backend
  call duration and inflight, pending tasks, task duration, seeds;
- Django: latency and rate per view, yhub client latency, pool waiting,
  Celery queue length;
- stores: Postgres connections and top queries, Valkey memory, commands and
  evictions.

## 1. Tooling

- HTTP: k6 (scenarios, thresholds, Prometheus output). Replay the real
  page-open sequence: `config`, `users/me`, `documents/{id}`, tree, list,
  plus `media-auth`.
- Collaboration: a Node swarm using the real client stack (`yjs`,
  `y-websocket`, `ws` with the cookie header, same options as the frontend).
  One process holds a few thousand sockets. Run it as a Job that goes through
  the ingress, on nodes that do not host the application.
  - Latency: writers stamp a timestamp into the doc, readers measure the
    propagation delay.
  - Convergence: compare state vectors across clients at the end.
  - Durability: compare against the admin `ydoc` endpoint.
  - k6 cannot reasonably speak the Yjs protocol, which is why this is a
    separate tool.
- Playwright canaries: 3 to 5 browsers reusing the `auth.setup.ts` storage
  state and the helpers in `src/frontend/apps/e2e` (`createDoc`,
  `writeInEditor`). They measure the user-perceived time to open a document
  and start typing while the swarm applies load.
- Workload model from production, not guesses:
  - `profile_volumetry` for the data shape;
  - access logs or PostHog for peak concurrent users, connections per
    document (long tail: mostly 1, a few at 50+), edit rate, reader/writer
    ratio.
  - Run at 1x, 2x and 5x, then ramp until the knee.

Location of the tooling: `src/loadtest/` (`swarm/` exists, see its README).

Note from the dev-stack check of the swarm: `create_load_test_sessions` writes
the sessions where the `LoadTest` configuration keeps them. In preprod the
server runs that same configuration; a server running another one reads its
sessions elsewhere (the dev stack's `Development` uses Redis db 2, `LoadTest`
db 0) and the cookies are worth nothing to it. yhub then admits the clients
anonymously on public documents, which looks like success: check the `userid`
in yhub's logs once before a campaign.

## 2. Scenarios, in order of value

1. **Migration.** Time the `migrate_documents` backfill at full volumetry:
   documents per second, growth of the yhub Postgres database, total
   duration, best `--concurrency`. Then test the `SOFT_MIGRATION` path under
   load: many users opening unmigrated documents at once. Each replica
   refuses seeds beyond 20 at once with a 503, so measure how many opens are
   refused and how long clients take to get in.
2. **HTTP baseline against the current release.** Same dataset, same k6
   script. Catches regressions unrelated to yhub.
3. **Connect ramp.** Find the connects-per-second ceiling per backend pod.
   `documents/{id}/` is not cheap: ancestor annotation, LinkTrace `exists()`
   and a possible INSERT.
4. **Idle steady state.** Ramp to 10k or more open sockets. Measure memory
   per connection, the 20 s resync floor, Valkey pub/sub traffic.
5. **Hot document.** 50 to 200 editors plus readers on one document.
   Awareness fan-out grows with the square of the number of clients.
6. **Wide editing.** Thousands of documents with 1 to 3 typists each.
   Stresses stream to worker to Postgres, and the `content-updated` to
   indexer to `get_ydoc` feedback loop. Watch stream length and worker lag.
7. **Reconnect storms.** Restart yhub (Argo-driven rollout), call
   `reset-connections`, trigger a Valkey failover and a Patroni failover (the
   Valkey one has to be run by the team that operates it).
   Clients return within 30 s of backoff plus 3 s of jitter, each costing 2
   to 3 Django calls and a document refetch. With no timeout in
   `backendFetch`, a slow Django means piled-up upgrades. This is the failure
   shape of the 2026-08-18, 2026-09-07 and 2026-09-14 outages.
8. **WS blocked, forcing the HTTP fallback.** Every poll re-runs the Django
   permission calls: N clients generate roughly 0.3 N requests per second on
   the backend. Probably the worst amplification in the system.
9. **Heavy synchronous endpoints.** Duplicate with descendants (holds a
   Postgres connection in a transaction during N yhub round-trips),
   `formatted-content`, import, and delete, restore and access changes on deep
   trees (one HTTP call per node on a single Celery queue with 1 worker).
10. **Large and long-history documents.** Open the 100 largest documents
    after migration and measure time to first sync.
11. **Soak.** 4 to 8 h at 1x. Watch memory leaks, Valkey memory growth,
    Postgres bloat in the yhub database, uvicorn worker recycling.
12. **Offline replay burst (browser only).** A fleet coming back online
    replays queued mutations at once. Lower priority.

## 3. Method

- Define SLOs first. Example targets: document open p95 under 2 s, edit
  propagation p95 under 500 ms, errors under 0.1 %, zero divergence, zero
  lost updates.
- One scenario at a time, stepped ramps with plateaus.
- At each knee, record which resource saturated (CPU, Postgres connections,
  Valkey memory, Node event loop), fix it, rerun.
- Keep each run's parameters, dashboards snapshot and results together so
  runs are comparable.

## 4. Hypotheses to verify

Suspected weak points from the code read, none confirmed by measurement:

- 2 to 3 uncached Django calls per WS connect and per fallback poll.
- No timeout or retry in yhub `backendFetch`.
- Django to yhub client without connection reuse, 30 s timeout, called inside
  `transaction.atomic` in `duplicate`.
- `content-updated` to indexer to `get_ydoc` feedback loop under wide editing.
- Single Celery queue with 1 replica for subtree cascades.
- Limit of 20 concurrent seeds per replica during soft migration, refused
  with a 503 beyond it, inside the upgrade handler.
- `migrate_documents` default concurrency of 2 making the backfill very long.
- Valkey memory: non-evictable stream entries against a small limit.
- No database connection persistence or pooling by default.
- No HPA and no resource requests, so scheduling and scaling are untested.
- `SyncManager` replay without backoff or jitter.
- JWKS fetch inside request authentication on cache miss (10 s timeout).

## 4b. Findings so far

Found while checking the tooling against the dev stack, before any campaign:

- **Concurrent `duplicate` calls collide on treebeard paths** (2026-09-22).
  Three users duplicating their own document at once, in `heavy.js`, get a
  500 (`IntegrityError: duplicate key value violates unique constraint
  "impress_document_path_key"`) or a 400 (`Document with this Path already
  exists`) on about a request out of seven. Root path allocation races between
  requests. To fix before the campaign, or scenario 9 measures the bug rather
  than the endpoint.

## 5. Work to do in this repository

1. Done: metrics in the backend (`/metrics`) and in `src/yhub-server`, Sentry
   in yhub, and the dedicated `ingressMetrics` in the chart (sections 0.1 and
   0.2).
2. Done: the `loadtest` application and the `LoadTest` configuration, minting
   sessions for synthetic clients (section 0.3).
3. Load generators reading the manifest of section 0.3, under `src/loadtest/`
   (not `src/backend/loadtest/`, which is the Django application):
   - Done (2026-09-22): the Node Yjs swarm, `src/loadtest/swarm/` (see its
     README). Modes `idle`, `hot`, `wide`, a ramp, a reconnect storm,
     propagation latency, convergence check, `/metrics`, a JSON report, a
     Dockerfile. Checked against the dev stack with sessions minted by
     `create_load_test_sessions`.
   - Done (2026-09-22): the k6 scripts, `src/loadtest/k6/` (see its README):
     `page-open.js`, the HTTP baseline (scenario 2) as a rate-based ramp of the
     frontend's document-open sequence plus `media-auth`; `heavy.js`, the
     synchronous endpoints (scenario 9): duplicate with descendants,
     `formatted-content`, delete/restore cascades, creation from a file. Both
     checked against the dev stack.
   - Done (2026-09-22): the canaries, `src/loadtest/canary/` (see its README).
     Real Chromium browsers in writer/reader pairs, through the real frontend
     and editor: page open, editor ready (provider synced), keystroke to the
     other screen, failures by step, on `/metrics` and in a JSON report.
     Checked against the dev stack: open p50 0.5 s, editor ready 1.3 s,
     propagation 70 ms with nothing else running.
   - Not done: the durability check against the admin `ydoc` endpoint (it
     needs an admin JWT the swarm should not hold), and the HTTP fallback
     scenario (`@y/yhub-http-fallback` is not driven by the swarm).
4. To do: preprod helm values — `DJANGO_CONFIGURATION=LoadTest`, metrics
   enabled on both services, resources and replicas matching production.
   Outside of this repository: the Valkey exporter and sizing, with the team
   that runs Valkey.
5. Done, from section 0.2: the custom backend metrics (outgoing calls,
   psycopg pool, Celery queue length). Left: Celery task duration.
