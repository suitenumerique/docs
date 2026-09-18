"""Prometheus metrics of the application, as served on /metrics.

Enabled by PROMETHEUS_METRICS_ENABLED and protected by
`core.middleware.PrometheusAuthMiddleware` — see documentation/metrics.md.
"""

import socket

from django.http import HttpResponse
from django.views.decorators.http import require_safe

from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, generate_latest
from prometheus_client.core import Metric
from prometheus_client.multiprocess import MultiProcessCollector

HOSTNAME_LABEL = "hostname"


class HostnameLabelCollector:
    """
    The metrics of every worker process of this host, labelled with its name.

    uvicorn runs several workers and the scrape is answered by one of them: the
    multiprocess collector reads what they all wrote to PROMETHEUS_MULTIPROC_DIR
    and adds it up, instead of reporting the numbers of that worker alone.

    The label is for a scraper that goes through a load balancer (an ingress in
    front of several replicas): each scrape is then answered by a different
    replica, and without it their counters would land in the same series, which
    would jump from the numbers of one replica to those of another. With it,
    each replica has its own series, sampled whenever it happens to answer.
    """

    def __init__(self):
        self.hostname = socket.gethostname()

    def collect(self):
        """Yield the aggregated metrics with the hostname added to every sample."""
        # a registry of its own: the collector registers itself in the one it is given
        for metric in MultiProcessCollector(CollectorRegistry()).collect():
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
    registry = CollectorRegistry()
    registry.register(HostnameLabelCollector())
    return HttpResponse(generate_latest(registry), content_type=CONTENT_TYPE_LATEST)
