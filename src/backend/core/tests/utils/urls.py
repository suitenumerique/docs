"""Utils for testing URLs."""

import importlib

from django.urls import clear_url_caches


class _URLConf:
    """
    Whether a test reloaded the URLs of this process.

    The URLconf is module-level state: a reload outlives the test that did it
    and every test running after it in the same worker sees its routes — which
    ones share a worker changes from one run to the next. `restore_urls` puts
    the default back, and this flag keeps it to the tests that need it.
    """

    reloaded = False


def _reload():
    """Reload the URL modules and drop the resolver caches."""
    import core.urls  # pylint:disable=import-outside-toplevel # noqa: PLC0415

    import impress.urls  # pylint:disable=import-outside-toplevel # noqa: PLC0415

    importlib.reload(core.urls)
    importlib.reload(impress.urls)
    clear_url_caches()


def reload_urls():
    """
    Reload the URLs. Since the URLs are loaded based on a
    settings value, we need to reload them to make the
    URL settings based condition effective.
    """
    _URLConf.reloaded = True
    _reload()


def restore_urls():
    """
    Reload the URLs of a test that changed them, so the next one starts clean.

    Called once the settings of the test are restored, so the routes are the
    ones the settings of the project declare.
    """
    if _URLConf.reloaded:
        _URLConf.reloaded = False
        _reload()
