"""
Test the measurements the application takes of itself: outgoing calls, database
pool and Celery queue.
"""

import os
import subprocess
import sys
from unittest import mock

from django.core.signals import request_finished

import pytest
import requests
from prometheus_client import REGISTRY, CollectorRegistry, generate_latest

from core import factories, instrumentation, metrics
from core.services.yhub_services import APIError, YHubService

pytestmark = pytest.mark.django_db

DURATION = "docs_outgoing_request_duration_seconds_count"
INFLIGHT = "docs_outgoing_requests_inflight"


def sample(name, **labels):
    """The value of a sample of the default registry, 0 when it does not exist."""
    return REGISTRY.get_sample_value(name, labels) or 0


@pytest.fixture(name="metrics_enabled")
def metrics_enabled_fixture(settings):
    """Turn the measurements on, as PROMETHEUS_METRICS_ENABLED does."""
    settings.PROMETHEUS_METRICS_ENABLED = True
    return settings


def test_instrumentation_outgoing_request_disabled(settings):
    """With the metrics off a call is not measured, and goes through untouched."""
    settings.PROMETHEUS_METRICS_ENABLED = False
    labels = {"service": "test-off", "operation": "op", "method": "GET"}

    with instrumentation.outgoing_request("test-off", "op", "get") as observed:
        observed.status = 200

    assert sample(DURATION, **labels, status="200") == 0


@pytest.mark.usefixtures("metrics_enabled")
def test_instrumentation_outgoing_request_counts_the_status():
    """A call is counted under the status its caller reported, and is in flight meanwhile."""
    labels = {"service": "test-status", "operation": "op", "method": "GET"}

    with instrumentation.outgoing_request("test-status", "op", "get") as observed:
        assert sample(INFLIGHT, **labels) == 1
        observed.status = 503

    assert sample(INFLIGHT, **labels) == 0
    assert sample(DURATION, **labels, status="503") == 1


@pytest.mark.usefixtures("metrics_enabled")
@pytest.mark.parametrize(
    "error,status",
    [
        (requests.ReadTimeout("too slow"), "timeout"),
        (requests.ConnectTimeout("too slow"), "timeout"),
        (requests.ConnectionError("refused"), "error"),
        (ValueError("anything else"), "error"),
    ],
)
def test_instrumentation_outgoing_request_failures(error, status):
    """A call given up on is told apart from one that failed, and both are re-raised."""
    labels = {"service": f"test-{status}", "operation": "op", "method": "POST"}
    before = sample(DURATION, **labels, status=status)

    with pytest.raises(type(error)):
        with instrumentation.outgoing_request(f"test-{status}", "op"):
            raise error

    assert sample(DURATION, **labels, status=status) == before + 1
    assert sample(INFLIGHT, **labels) == 0


def test_instrumentation_yhub_client_is_measured_by_endpoint(metrics_enabled):
    """The yhub client is measured under the endpoint it calls, never under the url."""
    # CI runs without the dev environment files: the client needs its base url
    metrics_enabled.YHUB_API_BASE_URL = "http://yhub:3002"
    document = factories.DocumentFactory()
    labels = {"service": "yhub", "operation": "ydoc", "method": "GET"}
    ok_before = sample(DURATION, **labels, status="200")
    missing_before = sample(DURATION, **labels, status="404")

    response = mock.Mock(ok=True, status_code=200, content=b"\\x00\\x00")
    with mock.patch("core.services.yhub_services.requests.request") as mock_request:
        mock_request.return_value = response
        YHubService().request("get", YHubService().build_url("ydoc", document))
        mock_request.return_value = mock.Mock(
            ok=False, status_code=404, text="", json=mock.Mock(return_value={})
        )
        with pytest.raises(APIError):
            YHubService().request("get", YHubService().build_url("ydoc", document))

    assert sample(DURATION, **labels, status="200") == ok_before + 1
    assert sample(DURATION, **labels, status="404") == missing_before + 1
    # the document never makes it to a label
    assert str(document.id) not in generate_latest(REGISTRY).decode()


class FakePool:
    """A psycopg pool, as far as its statistics go."""

    def __init__(self, stats=None, error=None):
        self.stats = stats
        self.error = error

    def pop_stats(self):
        """Hand the counters over, as psycopg does."""
        if self.error:
            raise self.error
        return self.stats


class FakeConnections(dict):
    """`django.db.connections`: iterating it yields the aliases."""


def fake_connection(pool=None):
    """A database connection configured with or without a pool."""
    return mock.Mock(
        settings_dict={"OPTIONS": {"pool": {"min_size": 1}} if pool else {}}, pool=pool
    )


def test_instrumentation_database_pool(monkeypatch):
    """The state and the counters of each pooled connection are recorded."""
    stats = {
        "pool_size": 8,
        "pool_available": 3,
        "requests_waiting": 2,
        "requests_num": 40,
        "requests_queued": 5,
        "requests_wait_ms": 1500,
        "requests_errors": 1,
        "connections_num": 8,
        "connections_errors": 2,
    }
    monkeypatch.setattr(
        metrics,
        "connections",
        FakeConnections(
            pooled=fake_connection(FakePool(stats)),
            plain=fake_connection(),
            broken=fake_connection(FakePool(error=RuntimeError("pool is closed"))),
        ),
    )
    before = sample("docs_db_pool_requests_total", alias="pooled")

    metrics.record_database_pool()
    metrics.record_database_pool()

    assert sample("docs_db_pool_size", alias="pooled") == 8
    assert sample("docs_db_pool_available", alias="pooled") == 3
    assert sample("docs_db_pool_requests_waiting", alias="pooled") == 2
    # what the pool popped twice is added up
    assert sample("docs_db_pool_requests_total", alias="pooled") == before + 80
    assert sample("docs_db_pool_requests_queued_total", alias="pooled") >= 10
    assert sample("docs_db_pool_requests_wait_seconds_total", alias="pooled") >= 3
    assert sample("docs_db_pool_requests_errors_total", alias="pooled") >= 2
    assert sample("docs_db_pool_connections_total", alias="pooled") >= 16
    assert sample("docs_db_pool_connections_errors_total", alias="pooled") >= 4
    # a connection without a pool is skipped, a pool that fails is survived
    assert REGISTRY.get_sample_value("docs_db_pool_size", {"alias": "plain"}) is None
    assert REGISTRY.get_sample_value("docs_db_pool_size", {"alias": "broken"}) is None


def test_instrumentation_connect_signals(settings):
    """The pool is only recorded at the end of requests when the metrics are enabled."""
    uid = "core.metrics.database_pool"
    try:
        settings.PROMETHEUS_METRICS_ENABLED = False
        instrumentation.connect_signals()
        assert not request_finished.disconnect(dispatch_uid=uid)

        settings.PROMETHEUS_METRICS_ENABLED = True
        instrumentation.connect_signals()
        assert request_finished.disconnect(dispatch_uid=uid)
    finally:
        request_finished.disconnect(dispatch_uid=uid)


def test_instrumentation_forget_dead_processes(monkeypatch, tmp_path):
    """
    The gauges of the workers that are gone are dropped, what they counted is kept.
    """
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", str(tmp_path))
    with subprocess.Popen([sys.executable, "-c", "pass"]) as process:
        process.wait()
    dead, alive = process.pid, os.getpid()
    for name in [
        f"gauge_livesum_{dead}.db",
        f"gauge_liveall_{dead}.db",
        f"gauge_livesum_{alive}.db",
        f"counter_{dead}.db",
        f"histogram_{dead}.db",
        "unrelated.txt",
    ]:
        (tmp_path / name).touch()

    metrics.forget_dead_processes()

    assert sorted(path.name for path in tmp_path.iterdir()) == sorted(
        [
            f"gauge_livesum_{alive}.db",
            f"counter_{dead}.db",
            f"histogram_{dead}.db",
            "unrelated.txt",
        ]
    )


def test_instrumentation_forget_dead_processes_without_directory(monkeypatch, tmp_path):
    """Nothing to do, and nothing to fail on, without a shared directory."""
    monkeypatch.delenv("PROMETHEUS_MULTIPROC_DIR", raising=False)
    metrics.forget_dead_processes()
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", str(tmp_path / "missing"))
    metrics.forget_dead_processes()


def fake_broker(lengths, driver_type="redis"):
    """A kombu connection to a broker holding these redis lists."""
    channel = mock.Mock(sep="\\x06\\x16", priority_steps=[0, 3, 6, 9])
    channel.client.llen.side_effect = lambda key: lengths.get(key, 0)
    connection = mock.MagicMock()
    connection.__enter__.return_value = connection
    connection.transport.driver_type = driver_type
    connection.default_channel = channel
    return connection


def collected(collector):
    """What a collector exposes, in the text format."""
    registry = CollectorRegistry()
    registry.register(collector)
    return generate_latest(registry).decode()


def test_instrumentation_celery_queue_length():
    """The tasks waiting on every priority of the default queue are added up."""
    broker = fake_broker({"celery": 4, "celery\\x06\\x163": 2, "other": 50})

    with mock.patch("impress.celery_app.app.connection_for_read", return_value=broker):
        output = collected(metrics.CeleryQueueCollector())

    assert 'docs_celery_queue_length{queue="celery"} 6.0' in output
    broker.ensure_connection.assert_called_once_with(max_retries=1, timeout=2)


@pytest.mark.parametrize(
    "broker",
    [
        fake_broker({}, driver_type="memory"),
        mock.MagicMock(__enter__=mock.Mock(side_effect=OSError("broker is down"))),
    ],
    ids=["not-redis", "unreachable"],
)
def test_instrumentation_celery_queue_length_unknown(broker):
    """A broker that cannot be asked yields no sample rather than failing the scrape."""
    with mock.patch("impress.celery_app.app.connection_for_read", return_value=broker):
        assert "docs_celery_queue_length" not in collected(
            metrics.CeleryQueueCollector()
        )
