"""Impress Core application"""

from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class CoreConfig(AppConfig):
    """Configuration class for the impress core app."""

    name = "core"
    app_label = "core"
    verbose_name = _("Impress core application")

    def ready(self):
        """
        Import signals when the app is ready, and wire the measurements driven
        by Django's own signals (a no-op unless the metrics are enabled).
        """
        # pylint: disable=import-outside-toplevel, unused-import
        from . import instrumentation, signals  # noqa: PLC0415

        instrumentation.connect_signals()
