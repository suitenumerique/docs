"""Impress Core application"""
from django.apps import AppConfig
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class CoreConfig(AppConfig):
    """Configuration class for the impress core app."""

    name = "core"
    app_label = "core"
    verbose_name = _("impress core application")

    def ready(self):
        super().ready()
        # Register custom Prometheus collector once per process when monitoring is enabled.
        if settings.PROMETHEUS_EXPORTER_ENABLED:
            # Lazy imports to avoid touching Django models/apps too early during setup.
            from prometheus_client.core import REGISTRY
            from core.api.custom_collector import CustomCollector

            collector = CustomCollector()
            # Ignore duplicate registration errors: Django's autoreloader, forked workers (gunicorn/uwsgi),
            # or multiple ready() runs in the same process can try to re-register the collector.
            try:
                REGISTRY.register(collector)
            except ValueError:
                pass
