"""
Tests for Find search feature flags
"""

import time
from unittest import mock

from django.http import HttpResponse

import pytest
import responses
from cryptography.fernet import Fernet
from rest_framework.test import APIClient
from waffle.testutils import override_flag

from core import factories
from core.enums import FeatureFlag
from core.services.search_indexers import get_document_indexer

pytestmark = pytest.mark.django_db


@responses.activate
@mock.patch("core.api.viewsets.DocumentViewSet._search_using_database")
@mock.patch("core.api.viewsets.DocumentViewSet._search_using_indexer")
@pytest.mark.parametrize("full_text_search_flag", [False, True])
def test_api_documents_search_success(
    mock_search_using_indexer,
    mock_search_using_database,
    full_text_search_flag,
    indexer_settings,
):
    """
    Only the users having the full text search flag should search with the indexer,
    the others should search the titles in the database, even with a Find token.
    """
    assert get_document_indexer() is not None
    key = Fernet.generate_key()
    indexer_settings.FIND_TOKEN_ENCRYPTION_KEY = key.decode()

    mock_search_using_indexer.return_value = HttpResponse()
    mock_search_using_database.return_value = HttpResponse()

    with override_flag(
        FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH, active=full_text_search_flag
    ):
        client = APIClient()
        client.force_login(factories.UserFactory())
        session = client.session
        session["find_access_token"] = Fernet(key).encrypt(b"find-token").decode()
        session["find_access_token_expiration"] = time.time() + 3600
        session.save()

        response = client.get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    assert mock_search_using_indexer.called is full_text_search_flag
    assert mock_search_using_database.called is not full_text_search_flag
