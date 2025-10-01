"""
Tests for Documents API endpoint in impress's core app: list
"""

from json import loads as json_loads

import pytest
import responses
from faker import Faker
from rest_framework.test import APIClient

from core import factories, models
from core.services.search_indexers import get_document_indexer

fake = Faker()
pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
@responses.activate
def test_api_documents_search_anonymous(reach, role, indexer_settings):
    """
    Anonymous users should not be allowed to search documents whatever the
    link reach and link role
    """
    indexer_settings.SEARCH_INDEXER_QUERY_URL = "http://find/api/v1.0/search"

    factories.DocumentFactory(link_reach=reach, link_role=role)

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


def test_api_documents_search_endpoint_is_none(indexer_settings):
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
        "user_role": access.role,
    }


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

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    user_a, user_b, user_c = factories.UserFactory.create_batch(3)
    document = factories.DocumentFactory(
        title="alpha",
        users=(user_a, user_c),
        link_traces=(user, user_b),
    )
    access = factories.UserDocumentAccessFactory(document=document, user=user)

    # Find response
    responses.add(
        responses.POST,
        "http://find/api/v1.0/search",
        json=[
            {"_id": str(document.pk)},
        ],
        status=200,
    )
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
        "nb_accesses_ancestors": 3,
        "nb_accesses_direct": 3,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": access.role,
    }


@responses.activate
def test_api_documents_search_pagination(indexer_settings):
    """Documents should be ordered by descending "updated_at" by default"""
    indexer_settings.SEARCH_INDEXER_QUERY_URL = "http://find/api/v1.0/search"

    assert get_document_indexer() is not None

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    docs = factories.DocumentFactory.create_batch(10)

    # Find response
    # pylint: disable-next=assignment-from-none
    api_search = responses.add(
        responses.POST,
        "http://find/api/v1.0/search",
        json=[{"_id": str(doc.pk)} for doc in docs],
        status=200,
    )

    response = client.get(
        "/api/v1.0/documents/search/", data={"q": "alpha", "page": 2, "page_size": 5}
    )

    assert response.status_code == 200
    content = response.json()
    results = content.pop("results")
    assert len(results) == 5

    # Check the query parameters.
    assert api_search.call_count == 1
    assert api_search.calls[0].response.status_code == 200
    assert json_loads(api_search.calls[0].request.body) == {
        "q": "alpha",
        "visited": [],
        "services": ["docs"],
        "page_number": 2,
        "page_size": 5,
        "order_by": "updated_at",
        "order_direction": "desc",
    }
