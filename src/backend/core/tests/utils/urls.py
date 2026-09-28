"""Utils for testing URLs."""

import importlib

from django.urls import clear_url_caches


def reload_urls():
    """
    Reload the URLs. Since the URLs are loaded based on a
    settings value, we need to reload them to make the
    URL settings based condition effective.
    """
    import core.urls  # pylint:disable=import-outside-toplevel # noqa: PLC0415

    import impress.urls  # pylint:disable=import-outside-toplevel # noqa: PLC0415

    importlib.reload(core.urls)
    importlib.reload(impress.urls)
    clear_url_caches()
