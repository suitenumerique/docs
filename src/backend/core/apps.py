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
        Import signals when the app is ready.
        """
        # pylint: disable=import-outside-toplevel, unused-import
        from . import signals  # noqa: PLC0415
