"""Hooks the application calls to be measured, cheap when nothing is measured.

The Prometheus metrics are opt-in (PROMETHEUS_METRICS_ENABLED). This module is
what the rest of the code imports: it has no dependency on prometheus_client, and
only loads `core.metrics` — where the metrics are defined — once they are enabled.
With the metrics off, every hook here is a test of a setting and nothing else.
"""

import time
from contextlib import contextmanager

from django.conf import settings

import requests


class ObservedRequest:
    """What the caller tells about the outgoing request it is making."""

    def __init__(self):
        self.status = None


@contextmanager
def outgoing_request(service, operation, method="POST"):
    """
    Time an HTTP call to another service.

        with outgoing_request("yhub", "ydoc", "GET") as observed:
            response = requests.get(...)
            observed.status = response.status_code

    The status label is the HTTP status the caller reported, `timeout` when the
    call was given up on, `error` when it never got an answer. Neither the url
    nor a document id is ever a label: `operation` names the endpoint.
    """
    observed = ObservedRequest()
    if not settings.PROMETHEUS_METRICS_ENABLED:
        yield observed
        return

    # pylint: disable-next=import-outside-toplevel
    from core import metrics  # noqa: PLC0415

    labels = {"service": service, "operation": operation, "method": method.upper()}
    metrics.OUTGOING_REQUESTS_INFLIGHT.labels(**labels).inc()
    start = time.perf_counter()
    status = "error"
    try:
        yield observed
        status = str(observed.status) if observed.status is not None else "unknown"
    except requests.Timeout:
        status = "timeout"
        raise
    finally:
        metrics.OUTGOING_REQUESTS_INFLIGHT.labels(**labels).dec()
        metrics.OUTGOING_REQUEST_DURATION.labels(**labels, status=status).observe(
            time.perf_counter() - start
        )


def connect_signals():
    """
    Wire the measurements that are driven by Django's signals. Called once the
    applications are loaded, and a no-op unless the metrics are enabled.
    """
    if not settings.PROMETHEUS_METRICS_ENABLED:
        return

    # pylint: disable-next=import-outside-toplevel
    from django.core.signals import request_finished  # noqa: PLC0415

    # pylint: disable-next=import-outside-toplevel
    from core import metrics  # noqa: PLC0415

    request_finished.connect(
        metrics.record_database_pool, dispatch_uid="core.metrics.database_pool"
    )
