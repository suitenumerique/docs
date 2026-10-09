"""Prometheus metrics of the application, as served on /metrics.

Enabled by PROMETHEUS_METRICS_ENABLED and protected by
`core.middleware.PrometheusAuthMiddleware` — see documentation/metrics.md.

Only imported when the metrics are enabled: the rest of the code goes through
`core.instrumentation`, which does not depend on prometheus_client.
"""

import logging
import os
import re
import socket

from django.conf import settings
from django.db import connections
from django.http import HttpResponse
from django.views.decorators.http import require_safe

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
    multiprocess,
)
from prometheus_client.core import GaugeMetricFamily, Metric
from prometheus_client.multiprocess import MultiProcessCollector

logger = logging.getLogger(__name__)

HOSTNAME_LABEL = "hostname"

# A call to another service answers in milliseconds when all is well and in tens
# of seconds when that service is drowning: both ends have to be readable.
LATENCY_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60)

OUTGOING_REQUEST_DURATION = Histogram(
    "docs_outgoing_request_duration_seconds",
    "Duration of the HTTP calls made to the other services (yhub, converters)",
    ["service", "operation", "method", "status"],
    buckets=LATENCY_BUCKETS,
)
OUTGOING_REQUESTS_INFLIGHT = Gauge(
    "docs_outgoing_requests_inflight",
    "HTTP calls to the other services that have not been answered yet",
    ["service", "operation", "method"],
    # one value per worker process: add up those that are still alive
    multiprocess_mode="livesum",
)

# The psycopg pool of each worker process (DB_PSYCOPG_POOL_ENABLED). The gauges
# are what the pool looked like at the end of the last request of each worker;
# the counters are exact, the pool counts them itself.
DATABASE_POOL_SIZE = Gauge(
    "docs_db_pool_size",
    "Connections the pools hold, idle or not",
    ["alias"],
    multiprocess_mode="livesum",
)
DATABASE_POOL_AVAILABLE = Gauge(
    "docs_db_pool_available",
    "Idle connections in the pools",
    ["alias"],
    multiprocess_mode="livesum",
)
DATABASE_POOL_REQUESTS_WAITING = Gauge(
    "docs_db_pool_requests_waiting",
    "Requests queued for a connection, all of them being taken",
    ["alias"],
    multiprocess_mode="livesum",
)
DATABASE_POOL_REQUESTS = Counter(
    "docs_db_pool_requests_total", "Connections asked to the pools", ["alias"]
)
DATABASE_POOL_REQUESTS_QUEUED = Counter(
    "docs_db_pool_requests_queued_total",
    "Connections asked to the pools that had to wait for one",
    ["alias"],
)
DATABASE_POOL_REQUESTS_WAIT_SECONDS = Counter(
    "docs_db_pool_requests_wait_seconds_total",
    "Time spent waiting for a connection of the pools",
    ["alias"],
)
DATABASE_POOL_REQUESTS_ERRORS = Counter(
    "docs_db_pool_requests_errors_total",
    "Connections asked to the pools that were not given (timeout, queue full)",
    ["alias"],
)
DATABASE_POOL_CONNECTIONS = Counter(
    "docs_db_pool_connections_total",
    "Connections the pools opened to the database",
    ["alias"],
)
DATABASE_POOL_CONNECTIONS_ERRORS = Counter(
    "docs_db_pool_connections_errors_total",
    "Connections the pools failed to open",
    ["alias"],
)

LIVE_GAUGE_FILE = re.compile(r"^gauge_live[a-z]*_(?P<pid>\d+)\.db$")


def record_database_pool(**_kwargs):
    """
    Record the state of the psycopg pools of this process. Connected to
    `request_finished`, so that it costs a request nothing while it runs.

    `pop_stats` hands the counters over and resets them, which is what lets them
    be added to ours whatever the number of worker processes.
    """
    for alias in connections:
        connection = connections[alias]
        if not connection.settings_dict.get("OPTIONS", {}).get("pool"):
            continue
        try:
            stats = connection.pool.pop_stats()
        except Exception:  # pylint: disable=broad-exception-caught
            # a measurement never fails a request
            logger.debug("could not read the database pool stats", exc_info=True)
            continue
        DATABASE_POOL_SIZE.labels(alias).set(stats.get("pool_size", 0))
        DATABASE_POOL_AVAILABLE.labels(alias).set(stats.get("pool_available", 0))
        DATABASE_POOL_REQUESTS_WAITING.labels(alias).set(
            stats.get("requests_waiting", 0)
        )
        DATABASE_POOL_REQUESTS.labels(alias).inc(stats.get("requests_num", 0))
        DATABASE_POOL_REQUESTS_QUEUED.labels(alias).inc(stats.get("requests_queued", 0))
        DATABASE_POOL_REQUESTS_WAIT_SECONDS.labels(alias).inc(
            stats.get("requests_wait_ms", 0) / 1000
        )
        DATABASE_POOL_REQUESTS_ERRORS.labels(alias).inc(stats.get("requests_errors", 0))
        DATABASE_POOL_CONNECTIONS.labels(alias).inc(stats.get("connections_num", 0))
        DATABASE_POOL_CONNECTIONS_ERRORS.labels(alias).inc(
            stats.get("connections_errors", 0)
        )


def forget_dead_processes():
    """
    Drop the gauges of the worker processes that are gone.

    A gauge that is summed over the living processes is kept in one file per
    process, and prometheus_client only removes it when told the process died.
    gunicorn has a hook for that, uvicorn has none: whoever answers a scrape
    checks instead. The directory is local to this host, so are the pids.
    Counters and histograms are left alone: what a dead worker counted stays part
    of the totals.
    """
    directory = os.environ.get("PROMETHEUS_MULTIPROC_DIR")
    if not directory:
        return
    try:
        names = os.listdir(directory)
    except OSError:
        return
    pids = {int(m["pid"]) for m in map(LIVE_GAUGE_FILE.match, names) if m}
    for pid in pids:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            multiprocess.mark_process_dead(pid)
        except OSError:
            # it exists and is not ours to signal: alive is all that matters
            continue


class CeleryQueueCollector:
    """
    The number of tasks waiting on the default Celery queue, asked to the broker
    when the metrics are scraped.

    The workers have no endpoint of their own, and the queue is what tells that
    they are not keeping up: the delete, restore and access cascades all land on
    it. One queue for the whole deployment: every replica reports the same
    number, which is to be read with max(), never summed.
    """

    def collect(self):
        """Yield the gauge, or nothing when the broker cannot be asked."""
        length = self.queue_length()
        if length is None:
            return
        gauge = GaugeMetricFamily(
            "docs_celery_queue_length",
            "Tasks waiting on the default Celery queue, for the whole deployment "
            "(use max, not sum)",
            labels=["queue"],
        )
        gauge.add_metric([self.queue_name()], length)
        yield gauge

    @staticmethod
    def queue_name():
        """The queue the tasks are sent to: none of them names another one."""
        # pylint: disable-next=import-outside-toplevel
        from impress.celery_app import app  # noqa: PLC0415

        return app.conf.task_default_queue

    def queue_length(self):
        """Ask the broker, quickly: a scrape must not hang on it."""
        # pylint: disable-next=import-outside-toplevel
        from impress.celery_app import app  # noqa: PLC0415

        try:
            with app.connection_for_read() as connection:
                if connection.transport.driver_type != "redis":
                    return None
                connection.ensure_connection(max_retries=1, timeout=2)
                channel = connection.default_channel
                queue = self.queue_name()
                # kombu keeps one redis list per priority step
                keys = [
                    f"{queue}{channel.sep}{priority}" if priority else queue
                    for priority in channel.priority_steps
                ]
                return sum(channel.client.llen(key) for key in keys)
        except Exception:  # pylint: disable=broad-exception-caught
            logger.debug("could not read the celery queue length", exc_info=True)
            return None


class WorkerProcessesCollector:
    """
    The metrics of every worker process of this host.

    uvicorn runs several workers and the scrape is answered by one of them: the
    multiprocess collector reads what they all wrote to PROMETHEUS_MULTIPROC_DIR
    and adds it up, instead of reporting the numbers of that worker alone.
    """

    def collect(self):
        """Yield the aggregated metrics."""
        # a registry of its own: the collector registers itself in the one it is given
        yield from MultiProcessCollector(CollectorRegistry()).collect()


class HostnameLabelled:
    """
    The metrics of another collector, labelled with the name of this host.

    The label is for a scraper that goes through a load balancer (an ingress in
    front of several replicas): each scrape is then answered by a different
    replica, and without it their counters would land in the same series, which
    would jump from the numbers of one replica to those of another. With it,
    each replica has its own series, sampled whenever it happens to answer.
    """

    def __init__(self, collector):
        self.collector = collector
        self.hostname = socket.gethostname()

    def collect(self):
        """Yield the metrics with the hostname added to every sample."""
        for metric in self.collector.collect():
            labelled = Metric(metric.name, metric.documentation, metric.type)
            for sample in metric.samples:
                labelled.add_sample(
                    sample.name,
                    {**sample.labels, HOSTNAME_LABEL: self.hostname},
                    sample.value,
                    sample.timestamp,
                    sample.exemplar,
                )
            yield labelled


@require_safe
def metrics_view(request):
    """Serve the metrics in the Prometheus text format."""
    forget_dead_processes()
    registry = CollectorRegistry()
    registry.register(HostnameLabelled(WorkerProcessesCollector()))
    if settings.PROMETHEUS_CELERY_QUEUE_METRICS_ENABLED:
        registry.register(HostnameLabelled(CeleryQueueCollector()))
    return HttpResponse(generate_latest(registry), content_type=CONTENT_TYPE_LATEST)
