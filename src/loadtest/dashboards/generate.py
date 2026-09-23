"""Generate the docs-loadtest-* dashboards: python3 generate.py <output directory>."""
import json, sys

# Every panel and query goes through the `datasource` variable, never a fixed
# uid: the boards are imported in Grafanas whose Prometheus is named anything
DS = {"type": "prometheus", "uid": "${datasource}"}
OUT = sys.argv[1]

def target(expr, legend="", ref="A"):
    return {"datasource": DS, "expr": expr, "legendFormat": legend, "refId": ref}

def panel(title, targets, unit="short", kind="timeseries", w=12, h=8, desc="", opts=None, stack=False, mn=None, mx=None):
    fc = {"defaults": {"unit": unit, "custom": {}}, "overrides": []}
    if stack: fc["defaults"]["custom"]["stacking"] = {"mode": "normal"}
    if mn is not None: fc["defaults"]["min"] = mn
    if mx is not None: fc["defaults"]["max"] = mx
    p = {"type": kind, "title": title, "description": desc, "datasource": DS,
         "targets": [dict(t, refId=chr(65 + i)) for i, t in enumerate(targets)],
         "fieldConfig": fc, "gridPos": {"w": w, "h": h}, "options": opts or {}}
    if kind == "timeseries":
        p["options"] = {"legend": {"displayMode": "list", "placement": "bottom", "showLegend": True},
                        "tooltip": {"mode": "multi", "sort": "desc"}, **(opts or {})}
    if kind == "stat":
        p["options"] = {"reduceOptions": {"calcs": ["lastNotNull"]}, "colorMode": "value", "graphMode": "area", **(opts or {})}
    return p

def row(title):
    return {"type": "row", "title": title, "collapsed": False, "gridPos": {"w": 24, "h": 1}, "panels": []}

def layout(panels):
    """Assign y/x from panel order: rows take a full line, panels pack left to right."""
    x = y = 0
    line_h = 0
    out = []
    for i, p in enumerate(panels):
        w, h = p["gridPos"]["w"], p["gridPos"]["h"]
        if p["type"] == "row" or x + w > 24:
            y += line_h
            x, line_h = 0, 0
        p["gridPos"].update({"x": x, "y": y})
        p["id"] = i + 1
        x += w
        line_h = max(line_h, h)
        if p["type"] == "row":
            y += 1
            x, line_h = 0, 0
        out.append(p)
    return out

def dashboard(uid, title, desc, panels, variables=(), tags=("docs", "loadtest")):
    templating = [{"name": "datasource", "label": "Prometheus", "type": "datasource", "query": "prometheus", "current": {}, "hide": 0, "refresh": 1}]
    for name, label, query in variables:
        templating.append({"name": name, "label": label, "type": "query", "datasource": DS, "query": {"query": query, "refId": name},
                           "definition": query, "refresh": 2, "includeAll": True, "multi": True, "allValue": ".*",
                           "current": {"text": "All", "value": "$__all"}, "sort": 1})
    return {"uid": uid, "title": title, "description": desc, "tags": list(tags), "schemaVersion": 39, "version": 1,
            "editable": True, "graphTooltip": 1, "time": {"from": "now-1h", "to": "now"}, "refresh": "15s",
            "timezone": "browser", "templating": {"list": templating}, "annotations": {"list": []},
            "panels": layout(panels)}

def q(quantile, metric, by="", rng="$__rate_interval", sel=""):
    by_clause = f" by (le{', ' + by if by else ''})"
    return f"histogram_quantile({quantile}, sum(rate({metric}_bucket{{{sel}}}[{rng}])){by_clause})"

H = 'hostname=~"$hostname"'

# ---------------------------------------------------------------- users
users = dashboard("docs-loadtest-users", "Docs load test — users",
    "What a user feels during a run: the browser canaries (src/loadtest/canary). The other boards say why.",
    [
        row("Canary — real browsers"),
        panel("Page open", [target(q(0.5, "canary_page_open_seconds"), "p50"), target(q(0.95, "canary_page_open_seconds"), "p95")], "s",
              desc="From the navigation to the document page being visible."),
        panel("Editor ready", [target(q(0.5, "canary_editor_ready_seconds"), "p50"), target(q(0.95, "canary_editor_ready_seconds"), "p95")], "s",
              desc="From the navigation to the editor accepting input: the collaboration provider synced. The number to compare against the 2 s target of the plan."),
        panel("Keystroke to the other screen", [target(q(0.5, "canary_propagation_seconds"), "p50"), target(q(0.95, "canary_propagation_seconds"), "p95")], "s",
              desc="From a keystroke in one browser to the text showing in another browser on the same document. Target of the plan: p95 under 500 ms."),
        panel("Iterations", [target("sum(rate(canary_iterations_total[$__rate_interval])) by (result)", "{{result}}")], "ops", stack=True),
        panel("Failures by step", [target("sum(increase(canary_failures_total[$__rate_interval])) by (step)", "{{step}}")], "short",
              desc="page-open: the page never showed. editor-ready: the provider never synced. propagation: the text never reached the other browser."),
        panel("Console errors", [target("sum(rate(canary_console_errors_total[$__rate_interval]))", "errors/s")], "ops", w=6),
        panel("Pairs running", [target("sum(canary_pairs)", "pairs")], "short", kind="stat", w=6),
        row("Swarm and k6, as a user would feel them"),
        panel("Swarm: time to connect and to first sync", [target(q(0.95, "swarm_connect_duration_seconds"), "connect p95"), target(q(0.95, "swarm_sync_duration_seconds"), "sync p95")], "s",
              desc="What a client of the swarm waits before the document is usable."),
        panel("Swarm: edit propagation", [target(q(0.5, "swarm_propagation_latency_seconds"), "p50"), target(q(0.95, "swarm_propagation_latency_seconds"), "p95"), target(q(0.99, "swarm_propagation_latency_seconds"), "p99")], "s"),
        panel("k6: page-open requests, p99 by endpoint", [target('max(k6_http_req_duration_p99{name!=""}) by (name)', "{{name}}")], "ms",
              desc="k6 exports its trends as gauges over the remote-write interval, p99 by default (K6_PROMETHEUS_RW_TREND_STATS adds p95)."),
        panel("k6: failed requests", [target("max(k6_http_req_failed_rate)", "failed"), target("1 - max(k6_checks_rate)", "checks failed")], "percentunit", mn=0, mx=1),
    ])

# --------------------------------------------------------- collaboration
collab = dashboard("docs-loadtest-collaboration", "Docs load test — collaboration server",
    "The collaboration server (yhub) under load, and what the swarm sees from the outside.",
    [
        row("Connections"),
        panel("Websocket connections per replica", [target(f"sum(yhub_ws_connections{{{H}}}) by (hostname)", "{{hostname}}")], "short", stack=True),
        panel("Open documents per replica", [target(f"sum(yhub_rooms{{{H}}}) by (hostname)", "{{hostname}}")], "short"),
        panel("Event loop lag p99 per replica", [target(f"max(nodejs_eventloop_lag_p99_seconds{{{H}, job=~\"yhub.*\"}}) by (hostname)", "{{hostname}}")], "s",
              desc="One thread serves every socket of a replica: this is the first thing to move when it saturates."),
        panel("Memory per replica", [target(f"max(process_resident_memory_bytes{{{H}, job=~\"yhub.*\"}}) by (hostname)", "{{hostname}}")], "bytes"),
        row("Admitting callers"),
        panel("Auth duration p95", [target(q(0.95, "yhub_auth_duration_seconds", "phase, endpoint", sel=H), "{{phase}} {{endpoint}}")], "s",
              desc="What a websocket upgrade, a recheck, a REST call or a fallback poll costs: the backend calls it makes, and the legacy seed under soft migration."),
        panel("Auth results", [target(f"sum(rate(yhub_auth_duration_seconds_count{{{H}}}[$__rate_interval])) by (phase, result)", "{{phase}} {{result}}")], "ops", stack=True,
              desc="unavailable: a 503 sent to the client, the backend did not answer."),
        panel("Backend calls p95 by route", [target(q(0.95, "yhub_backend_request_duration_seconds", "route", sel=H), "{{route}}")], "s"),
        panel("Backend calls in flight", [target(f"sum(yhub_backend_requests_inflight{{{H}}}) by (route)", "{{route}}")], "short", stack=True,
              desc="What piles up when the backend slows down: backendFetch has no timeout."),
        panel("Backend calls not answered 2xx", [target(f'sum(rate(yhub_backend_request_duration_seconds_count{{{H}, status!~"2.."}}[$__rate_interval])) by (route, status)', "{{route}} {{status}}")], "ops"),
        row("Persistence (worker)"),
        panel("Compaction backlog", [target("max(yhub_worker_pending_tasks)", "pending")], "short",
              desc="One queue for the whole deployment, reported by every worker: max, not sum."),
        panel("Compactions", [target(f"sum(rate(yhub_worker_task_duration_seconds_count{{{H}}}[$__rate_interval])) by (result)", "{{result}}"), target(f"sum(rate(yhub_doc_updates_total{{{H}}}[$__rate_interval]))", "with new content")], "ops"),
        panel("Compaction duration p95", [target(q(0.95, "yhub_worker_task_duration_seconds", sel=H), "p95")], "s"),
        panel("Compactions in flight", [target(f"sum(yhub_worker_tasks_inflight{{{H}}}) by (hostname)", "{{hostname}}")], "short", stack=True,
              desc="Against YHUB_TASK_CONCURRENCY per worker."),
        row("Soft migration"),
        panel("Seeds", [target(f"sum(rate(yhub_seed_duration_seconds_count{{{H}}}[$__rate_interval])) by (result)", "{{result}}"), target(f"sum(rate(yhub_seed_rejected_total{{{H}}}[$__rate_interval]))", "rejected")], "ops"),
        panel("Seed duration p95", [target(q(0.95, "yhub_seed_duration_seconds", "result", sel=H), "{{result}}")], "s"),
        panel("Seeds in flight", [target(f"sum(yhub_seeds_inflight{{{H}}}) by (hostname)", "{{hostname}}")], "short", desc="Refused with a 503 past 20 per replica."),
        row("Swarm — what the clients see"),
        panel("Swarm clients", [target("sum(swarm_clients) by (state)", "{{state}}")], "short", stack=True),
        panel("Connect and sync p95", [target(q(0.95, "swarm_connect_duration_seconds"), "connect"), target(q(0.95, "swarm_sync_duration_seconds"), "sync")], "s"),
        panel("Propagation", [target(q(0.5, "swarm_propagation_latency_seconds"), "p50"), target(q(0.95, "swarm_propagation_latency_seconds"), "p95"), target(q(0.99, "swarm_propagation_latency_seconds"), "p99")], "s"),
        panel("Reconnects and refused upgrades", [target("sum(rate(swarm_reconnects_total[$__rate_interval]))", "reconnects"), target("sum(rate(swarm_upgrade_failures_total[$__rate_interval])) by (status)", "refused {{status}}")], "ops"),
        panel("Socket closes by code", [target("sum(rate(swarm_ws_closes_total[$__rate_interval])) by (code)", "{{code}}")], "ops"),
        panel("Websocket traffic", [target("sum(rate(swarm_ws_bytes_total[$__rate_interval])) by (direction)", "{{direction}}")], "Bps"),
        panel("Swarm event loop lag p99", [target('max(nodejs_eventloop_lag_p99_seconds{job=~"swarm.*"})', "lag")], "s",
              desc="Past a point the load generator saturates before the server: its numbers stop meaning anything."),
    ], variables=[("hostname", "yhub replica", "label_values(yhub_ws_connections, hostname)")])

# --------------------------------------------------------------- backend
backend = dashboard("docs-loadtest-backend", "Docs load test — backend",
    "The Django backend under load: what it spends on the other services, its database pool, its queue, and what k6 sees from the outside. The generic Django board (17658) has the per-view detail.",
    [
        row("Requests"),
        panel("Requests by view", [target(f"sum(rate(django_http_requests_total_by_view_transport_method_total{{{H}}}[$__rate_interval])) by (view)", "{{view}}")], "reqps", stack=True),
        panel("Latency p95 by view", [target(q(0.95, "django_http_requests_latency_seconds_by_view_method", "view", sel=H), "{{view}}")], "s"),
        panel("Responses by status", [target(f"sum(rate(django_http_responses_total_by_status_view_method_total{{{H}}}[$__rate_interval])) by (status)", "{{status}}")], "reqps", stack=True),
        panel("Errors (5xx) by view", [target(f'sum(rate(django_http_responses_total_by_status_view_method_total{{{H}, status=~"5.."}}[$__rate_interval])) by (view)', "{{view}}")], "reqps"),
        row("Calls to the other services"),
        panel("Outgoing calls p95", [target(q(0.95, "docs_outgoing_request_duration_seconds", "service, operation", sel=H), "{{service}} {{operation}}")], "s",
              desc="yhub, and the converters. Made inside requests (duplicate, formatted-content, import) and from the Celery tasks."),
        panel("Outgoing calls in flight", [target(f"sum(docs_outgoing_requests_inflight{{{H}}}) by (service, operation)", "{{service}} {{operation}}")], "short", stack=True),
        panel("Outgoing calls failed", [target(f'sum(rate(docs_outgoing_request_duration_seconds_count{{{H}, status=~"timeout|error|5.."}}[$__rate_interval])) by (service, operation, status)', "{{service}} {{operation}} {{status}}")], "ops"),
        panel("Outgoing calls rate", [target(f"sum(rate(docs_outgoing_request_duration_seconds_count{{{H}}}[$__rate_interval])) by (service, operation)", "{{service}} {{operation}}")], "ops"),
        row("Database pool (DB_PSYCOPG_POOL_ENABLED)"),
        panel("Requests waiting for a connection", [target(f"sum(docs_db_pool_requests_waiting{{{H}}}) by (hostname)", "{{hostname}}")], "short", stack=True,
              desc="The application waiting for connections, before Postgres shows anything. What was missing in the 2026-08-18 and 2026-09-07 outages."),
        panel("Queued requests and time spent waiting", [target(f"sum(rate(docs_db_pool_requests_queued_total{{{H}}}[$__rate_interval]))", "queued/s"), target(f"sum(rate(docs_db_pool_requests_wait_seconds_total{{{H}}}[$__rate_interval]))", "wait s/s")], "short"),
        panel("Pool size and idle", [target(f"sum(docs_db_pool_size{{{H}}})", "size"), target(f"sum(docs_db_pool_available{{{H}}})", "idle")], "short"),
        panel("Connections opened to Postgres", [target(f"sum(rate(docs_db_pool_connections_total{{{H}}}[$__rate_interval]))", "opened/s"), target(f"sum(rate(docs_db_pool_connections_errors_total{{{H}}}[$__rate_interval]))", "errors/s")], "ops"),
        row("Queries and Celery"),
        panel("Query duration p95", [target(q(0.95, "django_db_query_duration_seconds", sel=H), "p95")], "s"),
        panel("Queries", [target(f"sum(rate(django_db_execute_total{{{H}}}[$__rate_interval]))", "queries/s"), target(f"sum(rate(django_db_errors_total{{{H}}}[$__rate_interval]))", "errors/s")], "ops"),
        panel("Celery queue length", [target("max(docs_celery_queue_length) by (queue)", "{{queue}}")], "short",
              desc="One queue for the whole deployment, reported by every replica: max, not sum. The delete, restore and access cascades land on it."),
        panel("Uvicorn workers alive", [target(f'count(count(django_http_requests_total_by_view_transport_method_total{{{H}}}) by (hostname))', "replicas")], "short",
              desc="Replicas answering scrapes. The memory and CPU of the pods come from the cluster (cAdvisor), not from the application: prometheus_client exports no process metrics in multiprocess mode."),
        row("k6 — what the clients see"),
        panel("k6 requests by endpoint", [target('sum(rate(k6_http_reqs_total[$__rate_interval])) by (name)', "{{name}}")], "reqps", stack=True),
        panel("k6 latency p99 by endpoint", [target('max(k6_http_req_duration_p99{name!=""}) by (name)', "{{name}}")], "ms"),
        panel("k6 failures", [target("max(k6_http_req_failed_rate)", "requests failed"), target("1 - max(k6_checks_rate)", "checks failed")], "percentunit", mn=0, mx=1),
        panel("k6 virtual users and dropped iterations", [target("max(k6_vus)", "VUs"), target("sum(rate(k6_dropped_iterations_total[$__rate_interval]))", "dropped/s")], "short",
              desc="Dropped iterations: the arrival rate asked for could not be served with the VUs allocated, the API was too slow."),
    ], variables=[("hostname", "backend replica", "label_values(django_http_requests_total_by_view_transport_method_total, hostname)")])

# ---------------------------------------------------------------- valkey
# redis_exporter (what chideat/valkey-operator runs next to every valkey pod),
# one target per pod: `job` names the instance, `instance` the pod.
J = 'job=~"$job", instance=~"$instance"'
valkey = dashboard("docs-loadtest-valkey", "Docs load test — valkey",
    "The two Valkey instances (valkey-docs: backend cache, sessions, Celery; valkey-yhub: the collaboration server's streams), through redis_exporter. One target per pod.",
    [
        row("Health"),
        panel("Up", [target(f"min(redis_up{{{J}}}) by (job, instance)", "{{job}} {{instance}}")], "short", kind="stat", w=6, mn=0, mx=1),
        panel("Role", [target(f"max(redis_instance_info{{{J}}}) by (job, instance, role)", "{{job}} {{instance}}: {{role}}")], "short", kind="stat", w=6,
              opts={"textMode": "name", "colorMode": "none", "graphMode": "none"},
              desc="master or slave, as INFO says it. A change is a failover."),
        panel("Uptime", [target(f"min(redis_uptime_in_seconds{{{J}}}) by (job, instance)", "{{job}} {{instance}}")], "s", kind="stat", w=6,
              desc="A reset is a restart: what wiped the sessions on 2026-09-07."),
        panel("Connected clients", [target(f"sum(redis_connected_clients{{{J}}}) by (job, instance)", "{{job}} {{instance}}")], "short", w=6),
        row("Memory"),
        panel("Memory used", [target(f"max(redis_memory_used_bytes{{{J}}}) by (job, instance)", "{{job}} {{instance}} used"), target(f"max(redis_memory_max_bytes{{{J}}} > 0) by (job, instance)", "{{job}} {{instance}} max")], "bytes",
              desc="Against maxmemory (0 when there is none, then hidden). The yhub streams have no TTL and cannot be evicted under volatile-lru: this is the number that decides how many replicas and how much history valkey-yhub can hold."),
        panel("Memory used, share of max", [target(f"max(redis_memory_used_bytes{{{J}}} / (redis_memory_max_bytes{{{J}}} > 0)) by (job, instance)", "{{job}} {{instance}}")], "percentunit", mn=0, mx=1),
        panel("Evicted and expired keys", [target(f"sum(rate(redis_evicted_keys_total{{{J}}}[$__rate_interval])) by (job, instance)", "{{job}} {{instance}} evicted"), target(f"sum(rate(redis_expired_keys_total{{{J}}}[$__rate_interval])) by (job, instance)", "{{job}} {{instance}} expired")], "ops",
              desc="Evictions on valkey-docs are sessions and cache entries thrown away under memory pressure."),
        panel("Fragmentation ratio", [target(f"max(redis_mem_fragmentation_ratio{{{J}}}) by (job, instance)", "{{job}} {{instance}}")], "short"),
        row("Traffic"),
        panel("Commands", [target(f"sum(rate(redis_commands_processed_total{{{J}}}[$__rate_interval])) by (job, instance)", "{{job}} {{instance}}")], "ops"),
        panel("Commands by command, top 10", [target(f"topk(10, sum(rate(redis_commands_total{{{J}}}[$__rate_interval])) by (job, cmd))", "{{job}} {{cmd}}")], "ops", stack=True),
        panel("Command latency p99", [target(f"histogram_quantile(0.99, sum(rate(redis_commands_latencies_usec_bucket{{{J}}}[$__rate_interval])) by (le, job, instance)) / 1e6", "{{job}} {{instance}}")], "s",
              desc="Server-side, from LATENCY HISTOGRAM: the time valkey spends on a command, not what the client waits."),
        panel("Time spent in commands, top 10", [target(f"topk(10, sum(rate(redis_commands_duration_seconds_total{{{J}}}[$__rate_interval])) by (job, cmd))", "{{job}} {{cmd}}")], "short", stack=True,
              desc="Seconds of command time per second: which commands the CPU goes to."),
        panel("Network", [target(f"sum(rate(redis_net_input_bytes_total{{{J}}}[$__rate_interval])) by (job, instance)", "{{job}} {{instance}} in"), target(f"sum(rate(redis_net_output_bytes_total{{{J}}}[$__rate_interval])) by (job, instance)", "{{job}} {{instance}} out")], "Bps",
              desc="On valkey-yhub the out side is the fan-out of every update to every replica of yhub."),
        panel("CPU", [target(f"sum(rate(redis_cpu_sys_seconds_total{{{J}}}[$__rate_interval]) + rate(redis_cpu_user_seconds_total{{{J}}}[$__rate_interval])) by (job, instance)", "{{job}} {{instance}}")], "percentunit",
              desc="One core is the ceiling: valkey runs its commands on one thread."),
        panel("Blocked clients and rejected connections", [target(f"sum(redis_blocked_clients{{{J}}}) by (job, instance)", "{{job}} {{instance}} blocked"), target(f"sum(rate(redis_rejected_connections_total{{{J}}}[$__rate_interval])) by (job, instance)", "{{job}} {{instance}} rejected/s")], "short",
              desc="Blocked: yhub replicas waiting on XREAD, which is normal. Rejected: maxclients reached."),
        panel("Slow log length", [target(f"max(redis_slowlog_length{{{J}}}) by (job, instance)", "{{job}} {{instance}}")], "short"),
        row("Keys"),
        panel("Keys", [target(f"sum(redis_db_keys{{{J}}}) by (job, instance, db)", "{{job}} {{instance}} {{db}}"), target(f"sum(redis_db_keys_expiring{{{J}}}) by (job, instance, db)", "{{job}} {{instance}} {{db}} expiring")], "short",
              desc="On valkey-docs, expiring keys are the sessions and the cache; on valkey-yhub the streams and locks."),
        panel("Cache hit ratio", [target(f"sum(rate(redis_keyspace_hits_total{{{J}}}[$__rate_interval])) by (job, instance) / (sum(rate(redis_keyspace_hits_total{{{J}}}[$__rate_interval])) by (job, instance) + sum(rate(redis_keyspace_misses_total{{{J}}}[$__rate_interval])) by (job, instance))", "{{job}} {{instance}}")], "percentunit", mn=0, mx=1),
        row("Streams (valkey-yhub, needs --check-streams on the exporter)"),
        panel("Stream length", [target(f"max(redis_stream_length{{{J}}}) by (job, stream)", "{{job}} {{stream}}")], "short",
              desc="yhub:worker is the compaction queue; the others are one per open document. Only exported when the exporter is started with --check-streams (REDIS_EXPORTER_CHECK_STREAMS=yhub:*)."),
        panel("Entries added", [target(f"sum(rate(redis_stream_entries_added_total{{{J}}}[$__rate_interval])) by (job, stream)", "{{job}} {{stream}}")], "ops"),
        panel("Consumer group pending and lag", [target(f"max(redis_stream_group_messages_pending{{{J}}}) by (job, stream, group)", "{{stream}} {{group}} pending"), target(f"max(redis_stream_group_lag{{{J}}}) by (job, stream, group)", "{{stream}} {{group}} lag")], "short",
              desc="Pending: claimed by a worker and not acknowledged yet. Lag: not claimed by anyone yet."),
        row("Replication and Sentinel"),
        panel("Replicas per master", [target(f"max(redis_connected_slaves{{{J}}}) by (job, instance)", "{{job}} {{instance}}")], "short"),
        panel("Replication offset", [target(f"max(redis_master_repl_offset{{{J}}}) by (job, instance)", "{{job}} {{instance}} master"), target(f"max(redis_slave_repl_offset{{{J}}}) by (job, instance)", "{{job}} {{instance}} replica")], "bytes",
              desc="A replica falling behind its master is what turns a failover into data loss."),
        panel("Replica link", [target(f"min(redis_master_link_up{{{J}}}) by (job, instance)", "{{job}} {{instance}} link up"), target(f"max(redis_master_last_io_seconds_ago{{{J}}}) by (job, instance)", "{{job}} {{instance}} last io (s)")], "short"),
        panel("Sentinel: quorum", [target('min(redis_sentinel_master_ok_sentinels) by (job, master_name)', "{{job}} {{master_name}} sentinels ok"), target('min(redis_sentinel_master_ok_slaves) by (job, master_name)', "{{job}} {{master_name}} replicas ok"), target('min(redis_sentinel_master_ckquorum_status) by (job, master_name)', "{{job}} {{master_name}} quorum")], "short",
              desc="From the sentinel pods, when they are scraped too. Sentinels ok below the quorum, or quorum status 0, means no failover is possible."),
        panel("Sentinel: master status", [target('max(redis_sentinel_master_status) by (job, master_name, master_status)', "{{job}} {{master_name}} {{master_status}}")], "short",
              desc="ok, or s_down / o_down when the sentinels have lost the master: the 2026-09-14 failover, seen from their side."),
        row("Persistence"),
        panel("Changes since last save", [target(f"max(redis_rdb_changes_since_last_save{{{J}}}) by (job, instance)", "{{job}} {{instance}}")], "short"),
        panel("Last fork", [target(f"max(redis_latest_fork_seconds{{{J}}}) by (job, instance)", "{{job}} {{instance}}")], "s",
              desc="A fork for a snapshot or an AOF rewrite stalls valkey for this long."),
    ], variables=[("job", "instance (job)", "label_values(redis_up, job)"), ("instance", "pod", 'label_values(redis_up{job=~"$job"}, instance)')])

for name, d in [("users", users), ("collaboration", collab), ("backend", backend), ("valkey", valkey)]:
    with open(f"{OUT}/{name}.json", "w") as f:
        json.dump(d, f, indent=2)
        f.write("\n")
print("generated")
