"""Fixtures for the tests of the load-test tooling."""

from django.core.cache import cache

import pytest


@pytest.fixture(autouse=True)
def clear_cache():
    """The sessions and their index live in the cache: start from an empty one."""
    cache.clear()


@pytest.fixture(name="load_test_enabled")
def load_test_enabled_fixture(settings):
    """What the `LoadTest` configuration sets."""
    settings.LOAD_TEST_TOOLS_ENABLED = True
    return settings
