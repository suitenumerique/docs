"""
Tests for Find search feature flags
"""

from unittest import mock

from django.http import HttpResponse

import pytest
import responses
from rest_framework.test import APIClient
from waffle.testutils import override_flag

from core.enums import FeatureFlag
from core.services.search_indexers import get_document_indexer

pytestmark = pytest.mark.django_db


@responses.activate
@mock.patch("core.api.viewsets.DocumentViewSet._search_using_database")
@mock.patch("core.api.viewsets.DocumentViewSet._search_using_indexer")
@pytest.mark.parametrize("full_text_search_flag", [False, True])
@pytest.mark.usefixtures("indexer_settings")
def test_api_documents_search_success(
    mock_search_using_indexer,
    mock_search_using_database,
    full_text_search_flag,
):
    """
    Only the users having the full text search flag should search with the indexer,
    the others should search the titles in the database.
    """
    assert get_document_indexer() is not None

    mock_search_using_indexer.return_value = HttpResponse()
    mock_search_using_database.return_value = HttpResponse()

    with override_flag(
        FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH, active=full_text_search_flag
    ):
        response = APIClient().get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    assert mock_search_using_indexer.called is full_text_search_flag
    assert mock_search_using_database.called is not full_text_search_flag
