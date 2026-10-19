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

In production the endpoint follows `SECURE_SSL_REDIRECT` like every other
path: a scrape over plain http is redirected to https, so that the key never
travels in clear. `PROMETHEUS_METRICS_SSL_REDIRECT_EXEMPT=True` lifts that for
`/metrics` only, for a scraper that reaches the process past the proxy
terminating TLS, see [several replicas](#several-replicas-behind-one-address).

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
cluster should scrape each pod directly instead: same path, same bearer token,
one target per pod. The chart builds the `ServiceMonitor` or `PodMonitor` for
it, see [below](#kubernetes-helm-chart). Such a scrape reaches the pod over
plain http, past the ingress that terminates TLS, and the Production settings
redirect it to https like anything else — where it gets nothing. Set
`PROMETHEUS_METRICS_SSL_REDIRECT_EXEMPT=True` to take `/metrics` out of that
redirect, the way the probes are; the pod's own address is already in
`ALLOWED_HOSTS`. Leave it off wherever the application is reached directly,
without a proxy in front: the redirect is then what keeps the bearer token off
the wire in clear.

## Kubernetes (Helm chart)

```yaml
backend:
  metrics:
    enabled: true              # PROMETHEUS_METRICS_ENABLED on the web pods, not on celery
  envVars:
    PROMETHEUS_API_KEY:
      secretKeyRef:
        name: backend
        key: PROMETHEUS_API_KEY

yhub:
  envVars:
    PROMETHEUS_API_KEY:        # the worker inherits it
      secretKeyRef:
        name: yhub
        key: PROMETHEUS_API_KEY
  metrics:
    enabled: true              # a port of its own, in the server and in the worker
```

`backend.metrics.enabled` sets `PROMETHEUS_METRICS_ENABLED` on the django
container only: the celery worker serves no request, so its metrics would never
be read. It sets `PROMETHEUS_METRICS_SSL_REDIRECT_EXEMPT` there too, since a pod
is only ever scraped over plain http. A value given in `backend.envVars` still
wins, and still reaches celery.

### Prometheus Operator, inside the cluster

```yaml
serviceMonitor:
  enabled: true
  labels:
    release: kube-prometheus-stack   # whatever your Prometheus selects monitors by
```

`serviceMonitor.enabled` (or `podMonitor.enabled`, or both) creates one monitor
per component whose metrics are enabled:

| Monitor | Scrapes | Port | Path | Job |
|---|---|---|---|---|
| `<release>-backend` | every backend web pod | `http` | `/metrics` | `backend` |
| `<release>-yhub` | every yhub server pod | `metrics` | `yhub.metrics.path` | `yhub` |
| `<release>-yhub-worker` | every yhub worker pod, when `yhub.worker.enabled` | `metrics` | `yhub.metrics.workerPath` | `yhub-worker` |

Each pod is a target of its own, so every sample of every replica is taken at
every interval, nothing goes through an ingress, and the `hostname` label is
simply the pod. The scrape presents the bearer token of the component, which
the Prometheus Operator reads from the Secret `PROMETHEUS_API_KEY` comes from
in the `envVars` above (or from the one named in `backend.metrics.apiKeySecret`
and `yhub.metrics.apiKeySecret`, for a token given as `PROMETHEUS_API_KEY_FILE`).
A token that is not in a Secret is refused at render time. That Secret has to
live in the namespace of the monitors, and the service account of the operator
be allowed to read it, as the kube-prometheus-stack one is.

A `ServiceMonitor` finds the pods through their Services, a `PodMonitor` through
their labels; they give the same targets. `interval`, `scrapeTimeout`,
`honorLabels`, `relabelings`, `metricRelabelings`, `labels`, `annotations` and
`namespace` are the same on both.

The dev cluster (`make start-tilt`, or `helmfile -e dev apply`) does exactly
this: its helmfile installs a trimmed
[kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
(`src/helm/env.d/dev/values.prometheus.yaml.gotmpl`: the operator, its CRDs
and one Prometheus, nothing else), the metrics of the backend and of yhub are
on with a token in the `docs-metrics` Secret, and `serviceMonitor.enabled`
builds the three monitors. The targets are at
https://docs-prometheus.127.0.0.1.nip.io/targets.

Next to it, a Grafana at https://docs-grafana.127.0.0.1.nip.io (admin /
admin) with the dashboards of the load-test campaign, from
`src/loadtest/dashboards/` (see its README): what the users feel, the
collaboration server, the backend, and the generic
[Django dashboard](https://grafana.com/grafana/dashboards/17658-django/)
of the community for the per-view detail of django-prometheus.

### A Prometheus outside of the cluster

```yaml
backend:
  envVars:
    DJANGO_ALLOWED_HOSTS: docs.example.com,metrics.docs.example.com

ingressMetrics:
  enabled: true
  host: metrics.docs.example.com
  annotations:
    nginx.ingress.kubernetes.io/whitelist-source-range: "203.0.113.10/32"
```

`ingressMetrics` routes the exact path `/metrics` of that host to the backend
and nothing else. Its host has to be in `DJANGO_ALLOWED_HOSTS`. With
`yhub.metrics.enabled`, the same ingress also publishes the server and the
worker, each on an exact path of its own:

| Path | Served by |
|---|---|
| `/metrics` | backend |
| `/metrics/yhub` | yhub server (websockets, authorizations, backend calls) |
| `/metrics/yhub-worker` | yhub worker (compactions), when `yhub.worker.enabled` |

That is three scrape jobs on one host, differing by `metrics_path`. What is said
above about [several replicas](#several-replicas-behind-one-address) applies to
each of them: yhub labels its samples with `hostname` too. Prefer the monitors
whenever the Prometheus can reach the pods.
