"""
WSGI config for the impress project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.1/howto/deployment/wsgi/
"""

import os

from configurations.wsgi import get_wsgi_application

# Prometheus Metrics Registration
from prometheus_client import REGISTRY

from core.api.custom_metrics_exporter import CustomMetricsExporter


def register_prometheus_exporter():
    """
    Register custom Prometheus metrics collector.
    """
    if not any(
        isinstance(collector, CustomMetricsExporter) for collector in REGISTRY.collect()
    ):
        REGISTRY.register(CustomMetricsExporter())


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "impress.settings")
os.environ.setdefault("DJANGO_CONFIGURATION", "Development")

if os.environ.get("MONITORING_PROMETHEUS_EXPORTER", "False").lower() == "true":
    register_prometheus_exporter()

application = get_wsgi_application()
