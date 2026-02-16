"""Fixtures for tests in the impress core application"""

from unittest import mock

from django.core.cache import cache

import pytest

USER = "user"
TEAM = "team"
VIA = [USER, TEAM]


@pytest.fixture(autouse=True)
def clear_cache():
    """Fixture to clear the cache before each test."""
    cache.clear()


@pytest.fixture
def mock_user_teams():
    """Mock for the "teams" property on the User model."""
    with mock.patch(
        "core.models.User.teams", new_callable=mock.PropertyMock
    ) as mock_teams:
        yield mock_teams


@pytest.fixture(name="indexer_settings")
def indexer_settings_fixture(settings):
    """
    Setup valid settings for the document indexer. Clear the indexer cache.
    """

    # pylint: disable-next=import-outside-toplevel
    from core.services.search_indexers import (  # noqa: PLC0415
        get_document_indexer,
    )

    get_document_indexer.cache_clear()

    settings.SEARCH_INDEXER_CLASS = "core.services.search_indexers.FindDocumentIndexer"
    settings.SEARCH_INDEXER_SECRET = "ThisIsAKeyForTest"
    settings.INDEXING_URL = "http://localhost:8081/api/v1.0/documents/index/"
    settings.SEARCH_URL = "http://localhost:8081/api/v1.0/documents/search/"
    settings.SEARCH_INDEXER_COUNTDOWN = 1

    yield settings

    # clear cache to prevent issues with other tests
    get_document_indexer.cache_clear()
