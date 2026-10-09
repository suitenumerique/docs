# Load testing Docs

How to find out whether a deployment of Docs holds the load it is meant for,
and where it stops: the tooling this repository ships for it, what it measures,
and how to run a campaign with it.

> ⚠️ **Never run any of this against a production instance.** The load
> generators log in as existing users with sessions minted outside of the
> identity provider, write into documents, create and delete documents, and
> put the whole deployment under stress on purpose. Run it on a copy: an
> instance of its own, loaded with **anonymized** data, sized like the one
> whose capacity you want to know. The `LoadTest` configuration that mints
> the sessions cannot be enabled on the `Production` one, on purpose.

## What is being tested

Docs is a Django backend (HTTP API, Celery tasks), a collaboration server
(`src/yhub-server`, built on `@y/hub`) holding the content of the documents,
two Valkey instances, PostgreSQL (one database each for the backend and the
collaboration server), an object storage, and a Next.js frontend. The parts
that decide how it scales, and that the scenarios below target:

- Every websocket connection, reconnection and http-fallback poll makes the
  collaboration server ask the backend two or three questions (`users/me/`,
  `documents/{id}/`, `documents/{id}/accesses/me/`). A reconnection storm is
  therefore a backend storm.
- The collaboration server's replicas share nothing: updates travel through
  Valkey streams, and a worker compacts them into PostgreSQL. Its throughput is
  `YHUB_TASK_CONCURRENCY` times the number of workers.
- Each compaction that found new content calls the backend
  (`content-updated`), which updates the document and reindexes it, which
  reads the document back from the collaboration server: a loop that wide
  editing feeds.
- Some backend endpoints call the collaboration server synchronously, inside
  the request: document creation from a file, `duplicate` (two round-trips per
  node, in one transaction), `formatted-content`. Delete, restore and access
  changes walk the subtree from Celery tasks, one call per node, on a single
  queue.
- The backend opens a connection per call to the collaboration server, and
  the collaboration server's calls to the backend have no timeout: a slow
  backend piles them up.
- The API throttles per user (80 requests a minute on the document
  endpoints), and the media route makes an access check for every attachment
  a page loads.
- Under soft migration (`SOFT_MIGRATION=true`), a document is seeded from the
  legacy store the first time it is opened, inside the websocket upgrade,
  at most 20 at a time per replica; past that the client gets a 503 and
  retries.

## What the repository ships

| Piece | Where | What it does |
| ----- | ----- | ------------ |
| Metrics | `metrics.md`, `src/yhub-server/README.md` | Prometheus metrics of the backend (requests by view, SQL, calls to the other services, the database pool, the Celery queue) and of the collaboration server (sockets, authorizations, backend calls, compactions, seeds), behind a bearer token |
| Session minting | `src/backend/loadtest/` | `create_load_test_sessions` logs existing users in without the identity provider and writes a manifest the generators read; `revoke_load_test_sessions` undoes it. Only with `DJANGO_CONFIGURATION=LoadTest` |
| Swarm | `src/loadtest/swarm/` | Thousands of websocket clients on the collaboration server, with the frontend's own client stack: connect time, sync time, edit propagation, reconnections, convergence |
| k6 scenarios | `src/loadtest/k6/` | The HTTP side: the sequence a browser runs when a document is opened, and the heavy endpoints |
| Canary | `src/loadtest/canary/` | A few real browsers opening and editing documents in a loop: what a user feels while the rest applies load |
| Dashboards | `src/loadtest/dashboards/` | Grafana boards over all of the above, plus Valkey and the community Django board |

Each directory has a README with its options. The dev cluster of this
repository (`make start-tilt`) runs the whole stack with a Prometheus and a
Grafana holding the boards, which is where to try the tooling before a
campaign.

## Setting an instance up for a campaign

The instance under test is a deployment of Docs like any other, with:

| What | How |
| ---- | --- |
| Session minting | `DJANGO_CONFIGURATION=LoadTest` on the backend. It is `Production` plus the `loadtest` application. Anybody who can run a management command on that instance can then act as any of its users: never an instance with real users |
| Metrics | `PROMETHEUS_METRICS_ENABLED` and a `PROMETHEUS_API_KEY` on the backend and on the collaboration server; in the Helm chart, `backend.metrics.enabled`, `yhub.metrics.enabled`, then `serviceMonitor.enabled` or `podMonitor.enabled` for a Prometheus inside the cluster (one target per pod, the better option), or `ingressMetrics` for one outside. See `metrics.md` |
| Sizing | The same replicas, resource limits, database pool and pooler, `YHUB_TASK_CONCURRENCY` and worker split as the deployment whose capacity is in question. Otherwise the numbers are only relative |
| Data | An anonymized copy of that deployment's database, with `migrate_documents` run to the end, and the object storage it points to |
| Noise | Emails, analytics, AI and webhooks off; `django-silk` off or sampling 1 % (`profiling.md`) |
| Error reporting | Sentry on both services, with a low trace sampling rate |
| Stores | The Valkey and PostgreSQL exporters in the same Prometheus. The Valkey board's streams row needs `redis_exporter` started with `--check-streams` on the collaboration server's instance (`src/loadtest/dashboards/README.md`) |

Import the boards of `src/loadtest/dashboards/` into the Grafana; they take
its default Prometheus datasource, switchable at the top of each board.

A workload model, from the deployment being sized rather than guessed: peak
concurrent users, connections per document (mostly one, a few with dozens),
edits per minute, share of readers. Run at 1×, 2× and 5× of it, then ramp
until something bends.

## Logging the virtual users in

From a pod running the backend image with the `LoadTest` configuration (the
chart's `backend.job.command` runs a management command as a Job):

```bash
python manage.py create_load_test_sessions 5000 --heaviest 50 \
    --documents-per-user 20 --public-documents 100 \
    --storage-name campaign-1.json --ttl-hours 12
```

The manifest goes to a private object of the default storage
(`loadtest/campaign-1.json`), or to a `0600` file with `--output`. It lists
the cookie name and, per user, a session key and the documents that user may
edit or read. **It holds live sessions and is a secret**: only the generators
read it, and it is revoked at the end:

```bash
python manage.py revoke_load_test_sessions --storage-name campaign-1.json
```

Users are picked among active, non-staff users holding an access to a live
document; `--heaviest N` takes the N holding the most. One distinct user per
virtual client, or the per-user throttle distorts every measurement: mint at
least as many sessions as the largest run needs, and give each generator pod
its own slice of the manifest's `sessions`.

Check once, before any run, that the collaboration server sees the users:
open one socket with a cookie of the manifest and read its logs for the
`userid`. A manifest minted for another configuration or another session
store makes the clients anonymous, which looks like success on public
documents. (In this repository's compose stack, the `Development`
configuration keeps its sessions in another Redis database than `LoadTest`:
mint with `REDIS_URL=redis://redis:6379/2` there.)

## Where the load comes from

From inside the cluster of the instance under test, as Jobs on nodes that do
not host the application, going through the ingress like a browser would.
Not from a laptop, and not from the application nodes: at ten thousand
sockets the swarm burns a core of its own, and the ingress, TLS termination
and timeouts are part of what is measured.

| Generator | Image | Runs as |
| --------- | ----- | ------- |
| swarm | `docker build -f src/loadtest/swarm/Dockerfile .` | one Job per slice of the manifest, a few thousand sockets each |
| k6 | `grafana/k6`, with `src/loadtest/k6` mounted | one Job per scenario |
| canary | `docker build -f src/loadtest/canary/Dockerfile .` | one Job, always on during the campaign |

The swarm and canary images are not built by CI: build them from the
repository root and push them to the cluster's registry. Every generator
serves `/metrics` (`--metrics-port`, `--metrics-token`): scrape the generator
pods too, so that their numbers sit next to the servers' on the boards. k6
pushes its own with `-o experimental-prometheus-rw` and
`K6_PROMETHEUS_RW_SERVER_URL`.

The options every run shares, with `docs.example.com` as the instance:

```bash
# swarm
node dist/index.js --manifest /manifest.json --url wss://docs.example.com \
    --metrics-port 9465 --metrics-token "$TOKEN" --report /out/swarm.json ...
# k6
k6 run --env MANIFEST=/manifest.json --env BASE_URL=https://docs.example.com \
    --env MEDIA_BASE_URL=https://docs.example.com \
    -o experimental-prometheus-rw scenarios/page-open.js
# canary
node dist/index.js --manifest /manifest.json --url https://docs.example.com \
    --pairs 3 --duration 28800 --metrics-port 9466 --metrics-token "$TOKEN"
```

k6's `ORIGIN` defaults to `BASE_URL`, right when `/api` is served on the
application host; it has to be one of `DJANGO_CSRF_TRUSTED_ORIGINS`. The
swarm's `--origin` defaults to `https://` plus the host of `--url`, which has
to be in `COLLABORATION_SERVER_ORIGIN`.

## The runs

Targets to set before starting, adjusted to the workload model: a document
opens in under 2 s at the 95th percentile, an edit reaches the other clients
in under 500 ms, fewer than 0.1 % of requests fail, no document diverges.

One scenario at a time; stepped ramps with plateaus; the canary up and the
boards open throughout. At each knee, note which panel bent first: that is
the capacity limit of the scenario, and the number that goes into the table
the campaign produces (sockets per collaboration replica, connections per
second per backend replica, edits per second per worker, documents migrated
per hour).

| # | Scenario | Command | What to watch |
| - | -------- | ------- | ------------- |
| 1 | Migration | `migrate_documents --concurrency N` on the full volumetry; then, with `SOFT_MIGRATION=true`, swarm `--mode wide` on unmigrated documents | documents per hour, growth of the collaboration database; `yhub_seed_*`, refused seeds |
| 2 | HTTP baseline | k6 `page-open.js --env RATE=<1×> --env DURATION=10m`, on the previous release and on this one, same data | backend board: latency by view, database pool, `media-auth` |
| 3 | Connect ramp | swarm `--mode idle --ramp 20`, raising `--ramp` per run until upgrades fail | `yhub_auth_duration_seconds`, backend calls in flight, `swarm_upgrade_failures_total`, `swarm_connect_duration_seconds` |
| 4 | Idle steady state | swarm `--mode idle --clients 10000 --duration 1800`, several Jobs | memory per collaboration replica, event-loop lag, Valkey memory and network |
| 5 | Hot document | swarm `--mode hot --doc <id> --clients 200 --writers 0.5 --edit-interval 500` | propagation p95, Valkey output, event-loop lag |
| 6 | Wide editing | swarm `--mode wide --clients 3000 --writers 0.3` | `yhub_worker_pending_tasks`, compaction duration, `docs_outgoing_*` (the reindexing loop), Celery queue |
| 7 | Reconnection storms | any of 4 to 6 with `--storm-at 300`; then, during a hold, a rolling restart of the collaboration server, a Valkey failover, a PostgreSQL failover | `swarm_reconnects_total`, closes by code, authorizations `unavailable`, backend calls in flight; sessions and cache on the Valkey board |
| 8 | HTTP fallback | not automated: a browser on a network that refuses websocket upgrades, with the canary | backend load per such client (about 0.3 requests/s each) |
| 9 | Heavy endpoints | k6 `heavy.js --env VUS=5` | `docs_outgoing_*`, pool waiting, Celery queue. See the known issue on `duplicate` below |
| 10 | Large documents | canary `--doc <one of the largest>` in turn | `canary_editor_ready_seconds` |
| 11 | Soak | 4 to 8 h at 1×: swarm wide, k6 page-open and the canary together | memory growth, Valkey memory, bloat of the collaboration database, `scrape_duration_seconds` of the backend |

Keep, per run: the generators' JSON reports and the k6 summary, a Grafana
snapshot or the time range, the values the instance ran with, and the line of
the capacity table it produced.

## Known issues and limits

- **Concurrent `duplicate` calls collide on tree paths.** Several users
  duplicating a document at the same time get a 500 (`IntegrityError` on the
  document path) or a 400 ("Document with this Path already exists") on a
  fraction of the calls: root path allocation races between requests. Fix it
  before scenario 9, or the scenario measures the bug.
- Under soft migration, a seed refused at the per-replica limit is logged as
  an error and reported to Sentry, one event per refused open.
- The collaboration server's calls to the backend have no timeout. Decide
  before the storm scenario whether to measure that as is or to add one.
- The backend exports no process metrics (CPU, memory) in multiprocess mode;
  take them from the cluster. Celery task duration is not exported.
- The swarm does not drive the http fallback, and does not check the
  persisted document against the collaboration server's REST API (it would
  need an admin token).
- The swarm and the canary write into the documents they open, and the heavy
  scenario leaves copies and imports in the trash until
  `TRASHBIN_CUTOFF_DAYS`. Anonymized data only.

## After the campaign

- `revoke_load_test_sessions`, and delete the manifest object.
- Put `DJANGO_CONFIGURATION` back to its normal value: the `loadtest`
  application must not stay installed.
- `purge_silk_profiles` if silk was on.
