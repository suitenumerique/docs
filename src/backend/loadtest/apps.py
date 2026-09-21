"""Application configuration of the load-test tooling."""

from django.apps import AppConfig
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class LoadTestConfig(AppConfig):
    """Tools that log synthetic users in, for load tests only."""

    name = "loadtest"
    verbose_name = "Load test tooling"

    def ready(self):
        """
        Refuse to load where the tooling is not enabled.

        The `LoadTest` configuration is the only one that installs this
        application, and the only one that enables the setting. Whoever adds it
        to the INSTALLED_APPS of another configuration gets a process that does
        not start, rather than a production able to mint sessions.
        """
        if not settings.LOAD_TEST_TOOLS_ENABLED:
            raise ImproperlyConfigured(
                "The `loadtest` application is installed but LOAD_TEST_TOOLS_ENABLED "
                "is not set: it must only be used with the `LoadTest` configuration."
            )
