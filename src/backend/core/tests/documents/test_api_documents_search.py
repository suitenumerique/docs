"""
Tests for Documents API endpoint in impress's core app: search
"""

from unittest import mock

import pytest
import responses
from faker import Faker
from rest_framework import response as drf_response
from rest_framework.test import APIClient

from core import factories
from core.services.search_indexers import get_document_indexer

fake = Faker()
pytestmark = pytest.mark.django_db


@mock.patch("core.services.search_indexers.FindDocumentIndexer.search_query")
@responses.activate
def test_api_documents_search_anonymous(search_query, indexer_settings):
    """
    Anonymous users should be allowed to search documents with Find.
    """
    indexer_settings.SEARCH_URL = "http://find/api/v1.0/search"

    # mock Find response
    responses.add(
        responses.POST,
        "http://find/api/v1.0/search",
        json=[],
        status=200,
    )

    q = "alpha"
    response = APIClient().get("/api/v1.0/documents/search/", data={"q": q})

    assert search_query.call_count == 1
    assert search_query.call_args[1] == {
        "data": {
            "q": q,
            "visited": [],
            "services": ["docs"],
            "nb_results": 50,
            "order_by": "updated_at",
            "order_direction": "desc",
            "path": None,
        },
        "token": None,
    }

    assert response.status_code == 200
    assert response.json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }


@mock.patch("core.api.viewsets.DocumentViewSet.list")
def test_api_documents_search_fall_back_on_search_list(mock_list, indexer_settings):
    """
    When indexer is not configured and no path is provided,
    should fall back on list method
    """
    indexer_settings.SEARCH_URL = None
    assert get_document_indexer() is None

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    mocked_response = {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [{"title": "mocked list result"}],
    }
    mock_list.return_value = drf_response.Response(mocked_response)

    q = "alpha"
    response = client.get("/api/v1.0/documents/search/", data={"q": q})

    assert mock_list.call_count == 1
    assert mock_list.call_args[0][0].GET.get("q") == q
    assert response.json() == mocked_response


@mock.patch("core.api.viewsets.DocumentViewSet._list_descendants")
def test_api_documents_search_fallback_on_search_list_sub_docs(
    mock_list_descendants, indexer_settings
):
    """
    When indexer is not configured and path parameter is provided,
    should call _list_descendants() method
    """
    indexer_settings.SEARCH_URL = "http://find/api/v1.0/search"
    assert get_document_indexer() is not None

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(title="parent", users=[user])

    mocked_response = {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [{"title": "mocked _list_descendants result"}],
    }
    mock_list_descendants.return_value = drf_response.Response(mocked_response)

    q = "alpha"
    response = client.get(
        "/api/v1.0/documents/search/", data={"q": q, "path": parent.path}
    )

    assert mock_list_descendants.call_count == 1
    assert mock_list_descendants.call_args[0][0].GET.get("q") == q
    assert mock_list_descendants.call_args[0][0].GET.get("path") == parent.path
    assert response.json() == mocked_response


@mock.patch("core.api.viewsets.DocumentViewSet._title_search")
def test_api_documents_search_indexer_crashes(mock_title_search, indexer_settings):
    """
    When indexer is configured but crashes -> falls back on title_search
    """
    # indexer is properly configured
    indexer_settings.SEARCH_URL = None
    assert get_document_indexer() is None
    # but returns an error when the query is sent
    responses.add(
        responses.POST,
        "http://find/api/v1.0/search",
        json=[{"error": "Some indexer error"}],
        status=404,
    )

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    mocked_response = {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [{"title": "mocked title_search result"}],
    }
    mock_title_search.return_value = drf_response.Response(mocked_response)

    parent = factories.DocumentFactory(title="parent", users=[user])
    q = "alpha"
    response = client.get(
        "/api/v1.0/documents/search/", data={"q": "alpha", "path": parent.path}
    )

    # the search endpoint did not crash
    assert response.status_code == 200
    # fallback on title_search
    assert mock_title_search.call_count == 1
    assert mock_title_search.call_args[0][0].GET.get("q") == q
    assert mock_title_search.call_args[0][0].GET.get("path") == parent.path
    assert response.json() == mocked_response


@responses.activate
def test_api_documents_search_invalid_params(indexer_settings):
    """Validate the format of documents as returned by the search view."""
    indexer_settings.SEARCH_URL = "http://find/api/v1.0/search"
    assert get_document_indexer() is not None

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.get("/api/v1.0/documents/search/")

    assert response.status_code == 400
    assert response.json() == {"q": ["This field is required."]}


@responses.activate
def test_api_documents_search_success(indexer_settings):
    """Validate the format of documents as returned by the search view."""
    indexer_settings.SEARCH_URL = "http://find/api/v1.0/search"
    assert get_document_indexer() is not None

    document = {"id": "doc-123", "title": "alpha", "path": "path/to/alpha.pdf"}

    # Find response
    responses.add(
        responses.POST,
        "http://find/api/v1.0/search",
        json=[
            {
                "_id": str(document["id"]),
                "_source": {"title": document["title"], "path": document["path"]},
            },
        ],
        status=200,
    )
    response = APIClient().get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    content = response.json()
    results = content.pop("results")
    assert content == {
        "count": 1,
        "next": None,
        "previous": None,
    }
    assert results == [
        {"id": document["id"], "title": document["title"], "path": document["path"]}
    ]
