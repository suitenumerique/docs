"""
Tests for Documents API endpoint in impress's core app: list
"""

import random
from json import loads as json_loads

from django.test import RequestFactory

import pytest
import responses
from faker import Faker
from rest_framework.test import APIClient

from core import factories, models
from core.services.search_indexers import get_document_indexer

fake = Faker()
pytestmark = pytest.mark.django_db


def build_search_url(**kwargs):
    """Build absolute uri for search endpoint with ORDERED query arguments"""
    return (
        RequestFactory()
        .get("/api/v1.0/documents/search/", dict(sorted(kwargs.items())))
        .build_absolute_uri()
    )


@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
@responses.activate
def test_api_documents_search_anonymous(reach, role, indexer_settings):
    """
    Anonymous users should not be allowed to search documents whatever the
    link reach and link role
    """
    indexer_settings.SEARCH_INDEXER_QUERY_URL = "http://find/api/v1.0/search"

    # Find response
    responses.add(
        responses.POST,
        "http://find/api/v1.0/search",
        json=[],
        status=200,
    )

    response = APIClient().get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    assert response.json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }


def test_api_documents_search_fall_back_on_search_list(indexer_settings):
    """
    Missing SEARCH_INDEXER_QUERY_URL, so the indexer is not properly configured.
    Should fallback on title filter
    """
    indexer_settings.SEARCH_INDEXER_QUERY_URL = None

    assert get_document_indexer() is None

    user = factories.UserFactory()
    document = factories.DocumentFactory(title="alpha")
    access = factories.UserDocumentAccessFactory(document=document, user=user)

    client = APIClient()
    client.force_login(user)

    response = client.get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    content = response.json()
    results = content.pop("results")
    assert content == {
        "count": 1,
        "next": None,
        "previous": None,
    }
    assert len(results) == 1
    assert results[0] == {
        "id": str(document.id),
        "abilities": document.get_abilities(user),
        "ancestors_link_reach": None,
        "ancestors_link_role": None,
        "computed_link_reach": document.computed_link_reach,
        "computed_link_role": document.computed_link_role,
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 1,
        "excerpt": document.excerpt,
        "link_reach": document.link_reach,
        "link_role": document.link_role,
        "nb_accesses_ancestors": 1,
        "nb_accesses_direct": 1,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "deleted_at": None,
        "user_role": access.role,
        'is_favorite': False,
    }


def test_api_documents_search_fallback_on_search_list_sub_docs(indexer_settings):
    """
    When indexer is not configured and path parameter is provided,
    should use _list_sub_docs to filter by path and title
    """
    indexer_settings.SEARCH_INDEXER_QUERY_URL = None

    assert get_document_indexer() is None

    user = factories.UserFactory()
    
    # Create a parent document and children
    parent = factories.DocumentFactory(title="parent alpha", users=[user])
    child1 = factories.DocumentFactory(title="child alpha", parent=parent, users=[user])
    child2 = factories.DocumentFactory(title="child beta", parent=parent, users=[user])
    other = factories.DocumentFactory(title="other alpha", users=[user])

    client = APIClient()
    client.force_login(user)

    # Search with path filter - should return parent and child1 only
    response = client.get(
        "/api/v1.0/documents/search/", 
        data={"q": "alpha", "path": parent.path}
    )

    assert response.status_code == 200
    content = response.json()
    results = content["results"]
    
    result_ids = {r["id"] for r in results}
    assert str(parent.id) in result_ids
    assert str(child1.id) in result_ids
    assert str(child2.id) not in result_ids
    assert str(other.id) not in result_ids


@responses.activate
def test_api_documents_search_invalid_params(indexer_settings):
    """Validate the format of documents as returned by the search view."""
    indexer_settings.SEARCH_INDEXER_QUERY_URL = "http://find/api/v1.0/search"

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    response = client.get("/api/v1.0/documents/search/")

    assert response.status_code == 400
    assert response.json() == {"q": ["This field is required."]}

    response = client.get("/api/v1.0/documents/search/", data={"q": "    "})

    assert response.status_code == 400
    assert response.json() == {"q": ["This field may not be blank."]}

    response = client.get(
        "/api/v1.0/documents/search/", data={"q": "any", "page": "NaN"}
    )

    assert response.status_code == 400
    assert response.json() == {"page": ["A valid integer is required."]}


@responses.activate
def test_api_documents_search_format(indexer_settings):
    """Validate the format of documents as returned by the search view."""
    indexer_settings.SEARCH_INDEXER_QUERY_URL = "http://find/api/v1.0/search"

    assert get_document_indexer() is not None

    document={"id": "doc-123", "title": "alpha", "path": "path/to/alpha.pdf"}

    # Find response
    responses.add(
        responses.POST,
        "http://find/api/v1.0/search",
        json=[
            {"_id": str(document["id"]), "_source": {"title": document["title"], "path": document["path"]}},
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
    assert len(results) == 1
    assert results[0] ==  {'id': document["id"], 'title': document["title"], 'path': document["path"]}
