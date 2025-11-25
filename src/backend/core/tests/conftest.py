"""Fixtures for tests in the impress core application"""

from unittest import mock

from django.core.cache import cache

import pytest

USER = "user"
TEAM = "team"
VIA = [USER, TEAM]


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "no_clear_cache: skip the autouse cache.clear() fixture for this test",
    )


@pytest.fixture(autouse=True)
def clear_cache(request):
    """
    Clear the cache before each test.

    Can be disabled with @pytest.mark.no_clear_cache for tests that need to
    exercise cache-backed behavior without interference.
    """
    if request.node.get_closest_marker("no_clear_cache"):
        yield
        return

    cache.clear()
    yield


@pytest.fixture
def mock_user_teams():
    """Mock for the "teams" property on the User model."""
    with mock.patch(
        "core.models.User.teams", new_callable=mock.PropertyMock
    ) as mock_teams:
        yield mock_teams
