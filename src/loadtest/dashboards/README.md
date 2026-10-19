# Dashboards of the load-test campaign

Grafana dashboards over the metrics of the campaign: the backend's and yhub's
`/metrics`, and what the load generators export (`../swarm`, `../k6`,
`../canary`). One board per question of `documentation/load-testing.md`: what the users feel, what the collaboration server does, what
the backend does. Each is laid out so that a saturation reads left to right:
the symptom the clients see, the server-side cause, the resource that ran out.

| File | Board | For |
| ---- | ----- | --- |
| `users.json` | Docs load test — users | The canary: page open, editor ready, keystroke to the other screen, failures by step. Plus the swarm's and k6's client-side numbers. The board that says "the users noticed"; the others say why |
| `collaboration.json` | Docs load test — collaboration server | yhub per replica: sockets, rooms, event-loop lag, auth duration, calls to the backend (duration, in flight, failures), compaction backlog and duration, seeds. Then the swarm: clients by state, connect and sync, propagation, reconnects, refused upgrades, close codes, traffic |
| `backend.json` | Docs load test — backend | Django: requests and latency by view, 5xx, calls to yhub and the converters (duration, in flight, failures), the psycopg pool (waiting, queued, wait time), queries, Celery queue length. Then k6: rate and p95 by endpoint, failures, VUs, dropped iterations |
| `valkey.json` | Docs load test — valkey | The two Valkey instances through `redis_exporter`, one target per pod: health and role, memory against `maxmemory`, evictions, commands and their latency, network, CPU, keys, the yhub streams, replication, Sentinel quorum and master status, persistence |
| `django.json` | Django | The community [Django dashboard 17658](https://grafana.com/grafana/dashboards/17658-django/) (revision 2), for the per-view detail of django-prometheus |

A `hostname` variable on the collaboration and backend boards narrows the
panels to one replica: the label every sample carries (`documentation/metrics.md`).

## Where they run

The dev cluster (`monitoring: true`, `src/helm/env.d/dev/values.prometheus.yaml.gotmpl`)
loads them into its Grafana, https://docs-grafana.127.0.0.1.nip.io, from
ConfigMaps built from these files. Anywhere else, import the JSON files as they
are: every panel goes through the `datasource` variable of the board, which
defaults to the Grafana's default Prometheus and can be switched at the top of
the board. No uid is hardcoded.

The k6 panels expect k6's Prometheus remote write
(`-o experimental-prometheus-rw`, see `../k6/README.md`): its trends arrive as
gauges, `k6_http_req_duration_p99` by default; set
`K6_PROMETHEUS_RW_TREND_STATS=p(95),p(99)` for a p95 too.

## What stays empty, and why

- On the valkey board, `maxmemory` panels when no limit is set, the streams
  row without `--check-streams`, the Sentinel row without the sentinel pods
  scraped (see Stores).
- Pod memory and CPU: not on these boards. The backend exports no process
  metrics (prometheus_client's multiprocess mode has none); take them from
  the cluster's cAdvisor. yhub does export `process_resident_memory_bytes`.
- Cache hit ratio, on the Django board: django-prometheus only counts cache
  calls through its own cache backends, which the backend does not use.
- The canary panels are empty until a canary runs; the k6 ones until k6 runs
  with the remote write.

## Changes to the community Django dashboard

`django.json` is revision 2 of dashboard 17658 with two edits, so that the
sidecar can load it as it is: the `${DS_PROMETHEUS}` import input is replaced
by the board's own `${datasource}` variable, and its `app` label filter (which nothing
here sets) by `job`, the label the chart's ServiceMonitor names the component
with (`backend`). Take a new revision from grafana.com the same way.

## Stores

Valkey is `valkey.json`, built for `redis_exporter` as a sidecar of every
valkey pod (what chideat/valkey-operator runs, and what the dev cluster's chart
runs), so the board has one target per pod: the `job` variable picks the
instance, `instance` the pod. Two things about that exporter:

- the operator's `exporter` spec sets an image, resources and a security
  context, and nothing else: no arguments, no environment. The streams row
  (`redis_stream_*`) needs `--check-streams` (or
  `REDIS_EXPORTER_CHECK_STREAMS=yhub:*`), which the operator cannot pass.
  What it does let through is the image (`exporter.image`), and it starts it
  as `/redis_exporter <its flags>`: an image where `/redis_exporter` is a
  two-line wrapper setting that variable and exec'ing the real binary gets the
  streams row with the operator's own command line (checked against
  redis_exporter v1.92.0). Otherwise, a second exporter run with the flag
  against valkey-yhub. The dev cluster's chart can pass the variable, and does;
- the Sentinel row needs the sentinel pods scraped as well.

Postgres is not here: use the board of your `postgres_exporter`. What a
campaign needs from it, per instance:

- Postgres (`postgres_exporter` or pghero): connections by state and by
  application name, transactions and tuples per second, the slowest queries
  (`pg_stat_statements` by total and mean time), replication lag, and the
  leader of the cluster. On the `yhub` database as well as the backend's.

## Editing

The three `docs-loadtest-*` boards are generated by `generate.py`
(`python3 generate.py .`): change the generator and regenerate, rather than the
JSON. A legend template such as `{{hostname}}` is fine in the JSON;
the dev values escape it for helm's `tpl` when building the ConfigMaps.
