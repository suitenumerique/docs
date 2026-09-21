# Prometheus metrics

This page is about the backend. The collaboration server (yhub) has metrics of
its own, served the same way — a bearer token, outside of what the ingress of
the application publishes — and documented in the "Metrics" section of
`src/yhub-server/README.md`. The [Helm section](#kubernetes-helm-chart) below
covers both.

## Backend

The backend ships an **opt-in** instrumentation,
[django-prometheus](https://github.com/django-commons/django-prometheus). It is
**disabled by default**: when `PROMETHEUS_METRICS_ENABLED` is unset,
`django_prometheus` is not in `INSTALLED_APPS`, its middlewares are not
installed, the database engine is left alone and `/metrics` is not routed.

## Enabling it

```bash
PROMETHEUS_METRICS_ENABLED=True
PROMETHEUS_API_KEY=<a long random secret>   # or PROMETHEUS_API_KEY_FILE
```

The application **refuses to start** with the metrics enabled and no key: the
endpoint would otherwise answer to anybody.

Then scrape `GET /metrics` with the key as a bearer token:

```yaml
scrape_configs:
  - job_name: docs-backend
    scheme: https
    metrics_path: /metrics
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/docs-api-key
    static_configs:
      - targets: ["metrics.docs.example.com"]
```

## What is measured

- HTTP requests: counts and latency histograms, labelled by **view name**,
  method and status
  (`django_http_requests_latency_seconds_by_view_method`,
  `django_http_responses_total_by_status_view_method_total`, ...).
- SQL (unless `PROMETHEUS_DB_METRICS_ENABLED=False`): queries, errors and query
  duration (`django_db_execute_total`, `django_db_query_duration_seconds`, ...).
  With `DB_PSYCOPG_POOL_ENABLED`, `django_db_new_connections_total` counts the
  connections taken from the pool, not the connections opened to Postgres.

- Calls to the other services, in
  `docs_outgoing_request_duration_seconds{service,operation,method,status}` and
  `docs_outgoing_requests_inflight{service,operation,method}`. `service` is
  `yhub`, `y-provider` or `docspec`; `operation` is the endpoint (`ydoc`,
  `create-ydoc`, `reset-connections`, `convert`, ...), never the url; `status`
  is the http status, `timeout` when the call was given up on, `error` when it
  never got an answer. These calls are made inside requests (`duplicate`,
  `formatted-content`, document creation from a file) and from the Celery
  tasks: the in-flight gauge is what piles up when the collaboration server
  slows down.
- The psycopg pool, when `DB_PSYCOPG_POOL_ENABLED` is on:
  `docs_db_pool_size`, `docs_db_pool_available` and
  `docs_db_pool_requests_waiting` (what the pool of each worker looked like at
  the end of its last request, added up), and the exact counters of the pool:
  `docs_db_pool_requests_total`, `docs_db_pool_requests_queued_total`,
  `docs_db_pool_requests_wait_seconds_total`,
  `docs_db_pool_requests_errors_total`, `docs_db_pool_connections_total`,
  `docs_db_pool_connections_errors_total`. A rising
  `rate(docs_db_pool_requests_queued_total)` with
  `rate(docs_db_pool_requests_wait_seconds_total)` is the application waiting
  for connections, before Postgres shows anything.
- `docs_celery_queue_length{queue}`: tasks waiting on the default Celery queue,
  asked to the broker when the metrics are scraped (Redis/Valkey brokers only;
  turn it off with `PROMETHEUS_CELERY_QUEUE_METRICS_ENABLED=False`). It is one
  queue for the whole deployment, so every replica reports the same number:
  read it with `max`, never `sum`. The Celery workers have no endpoint of
  their own, which is why the backend reports it.

No label ever carries a path, a user or a document identifier. A request that
matches no route is counted under `<unnamed view>`.

Every sample carries a `hostname` label (the pod name in Kubernetes), see
[Several replicas](#several-replicas-behind-one-address).

## How the endpoint is protected

| Layer | What it guarantees |
|---|---|
| Off by default | Nothing is installed, and `/metrics` is a 404, unless the deployment asks for it |
| Served on `/metrics`, not under `/api/` | The ingress of the application publishes `/api` and `/external_api` only: the metrics are not reachable from outside until a route is added on purpose |
| Bearer token | `core.middleware.PrometheusAuthMiddleware` refuses anything but `Authorization: Bearer <PROMETHEUS_API_KEY>`, compared in constant time. It fails closed: no key, no answer |
| First middleware | A refused call stops there: no session is created, no database or cache access is made |
| Dedicated ingress (chart) | One exact path on a host of its own, where the callers are filtered by address |
| Labels | No path, user or document identifier leaves the application |

The key is a long-lived shared secret, which is what a Prometheus scraper can
present. Treat it as such: give it through `PROMETHEUS_API_KEY_FILE` or a
Kubernetes secret, keep TLS on wherever it travels, and rotate it by changing
the value on both sides.

## uvicorn workers

uvicorn runs several worker processes (`WEB_CONCURRENCY`) and a scrape is
answered by one of them. The workers therefore all write their numbers to one
directory (prometheus_client's multiprocess mode), and whichever answers adds
them up. Nothing has to be configured: the directory defaults to
`<tmp>/impress-prometheus-<uid>`, is created with mode `0700`, and the
application refuses a directory owned by another user or a symbolic link. Set
`PROMETHEUS_MULTIPROC_DIR` to put it elsewhere — it must be writable, and local
to the host or the pod: it is **not** shared between replicas.

The gauges (in-flight calls, pool state) are kept per worker process and added
up over the living ones. uvicorn has no hook telling when a worker is gone, so
whichever worker answers a scrape first drops the gauge files of the processes
that no longer exist.

Known limit: uvicorn recycles its workers (`--limit-max-requests`) and has no
hook to tell when one is gone. Every new worker writes two new 64 KiB files,
and the files of the workers that are gone must stay — their counters are part
of the totals. The directory grows, and the scrape gets slower, until the
container is replaced. Watch `scrape_duration_seconds` on long runs. Outside of
a container, empty the directory when the application is stopped.

## Several replicas behind one address

A scrape that goes through a load balancer — the dedicated ingress in front of
several backend pods — is answered by a different replica each time. The
`hostname` label keeps the replicas apart: each has its own series, and its
counters never go backwards. Each series is only sampled when its replica
happens to answer, so with `N` replicas expect one sample every `N` scrapes on
average: use a short scrape interval and rate windows of several minutes, and
aggregate with `sum without (hostname) (rate(...[5m]))`.

This degrades as the number of replicas grows. A Prometheus running inside the
cluster should scrape each pod directly instead (a `PodMonitor` or pod
discovery on the `http` port, same path, same bearer token).

## Kubernetes (Helm chart)

```yaml
backend:
  envVars:
    PROMETHEUS_METRICS_ENABLED: "True"
    PROMETHEUS_API_KEY:
      secretKeyRef:
        name: backend
        key: PROMETHEUS_API_KEY
    DJANGO_ALLOWED_HOSTS: docs.example.com,metrics.docs.example.com

ingressMetrics:
  enabled: true
  host: metrics.docs.example.com
  annotations:
    nginx.ingress.kubernetes.io/whitelist-source-range: "203.0.113.10/32"
```

`ingressMetrics` routes the exact path `/metrics` of that host to the backend
and nothing else. Its host has to be in `DJANGO_ALLOWED_HOSTS`.

With yhub, the same ingress also publishes the server and the worker, each on an
exact path of its own:

```yaml
yhub:
  envVars:
    PROMETHEUS_API_KEY:          # the worker inherits it
      secretKeyRef:
        name: yhub
        key: PROMETHEUS_API_KEY
  metrics:
    enabled: true                # /metrics/yhub and /metrics/yhub-worker
```

| Path | Served by |
|---|---|
| `/metrics` | backend |
| `/metrics/yhub` | yhub server (websockets, authorizations, backend calls) |
| `/metrics/yhub-worker` | yhub worker (compactions), when `yhub.worker.enabled` |

That is three scrape jobs on one host, differing by `metrics_path`. What is said
above about [several replicas](#several-replicas-behind-one-address) applies to
each of them: yhub labels its samples with `hostname` too.

The celery worker receives `backend.envVars` too. It serves no request, so its
metrics are never read: turn them off there with
`backend.celery.envVars.PROMETHEUS_METRICS_ENABLED: "False"`.
