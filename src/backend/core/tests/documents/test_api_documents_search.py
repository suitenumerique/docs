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
        "deleted_at": None,
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
        "deleted_at": None,
        "user_role": access.role,
    }


@responses.activate
@pytest.mark.parametrize(
    "pagination, status, expected",
    (
        (
            {"page": 1, "page_size": 10},
            200,
            {
                "count": 10,
                "previous": None,
                "next": None,
                "range": (0, None),
            },
        ),
        (
            {},
            200,
            {
                "count": 10,
                "previous": None,
                "next": None,
                "range": (0, None),
                "api_page_size": 21,  # default page_size is 20
            },
        ),
        (
            {"page": 2, "page_size": 10},
            404,
            {},
        ),
        (
            {"page": 1, "page_size": 5},
            200,
            {
                "count": 10,
                "previous": None,
                "next": {"page": 2, "page_size": 5},
                "range": (0, 5),
            },
        ),
        (
            {"page": 2, "page_size": 5},
            200,
            {
                "count": 10,
                "previous": {"page_size": 5},
                "next": None,
                "range": (5, None),
            },
        ),
        ({"page": 3, "page_size": 5}, 404, {}),
    ),
)
def test_api_documents_search_pagination(
    indexer_settings, pagination, status, expected
):
    """Documents should be ordered by descending "score" by default"""
    indexer_settings.SEARCH_INDEXER_QUERY_URL = "http://find/api/v1.0/search"

    assert get_document_indexer() is not None

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    docs = factories.DocumentFactory.create_batch(10, title="alpha", users=[user])

    docs_by_uuid = {str(doc.pk): doc for doc in docs}
    api_results = [{"_id": id} for id in docs_by_uuid.keys()]

    # reorder randomly to simulate score ordering
    random.shuffle(api_results)

    # Find response
    # pylint: disable-next=assignment-from-none
    api_search = responses.add(
        responses.POST,
        "http://find/api/v1.0/search",
        json=api_results,
        status=200,
    )

    response = client.get(
        "/api/v1.0/documents/search/",
        data={
            "q": "alpha",
            **pagination,
        },
    )

    assert response.status_code == status

    if response.status_code < 300:
        previous_url = (
            build_search_url(q="alpha", **expected["previous"])
            if expected["previous"]
            else None
        )
        next_url = (
            build_search_url(q="alpha", **expected["next"])
            if expected["next"]
            else None
        )
        start, end = expected["range"]

        content = response.json()

        assert content["count"] == expected["count"]
        assert content["previous"] == previous_url
        assert content["next"] == next_url

        results = content.pop("results")

        # The find api results ordering by score is kept
        assert [r["id"] for r in results] == [r["_id"] for r in api_results[start:end]]

        # Check the query parameters.
        assert api_search.call_count == 1
        assert api_search.calls[0].response.status_code == 200
        assert json_loads(api_search.calls[0].request.body) == {
            "q": "alpha",
            "visited": [],
            "services": ["docs"],
            "nb_results": 50,
            "order_by": "updated_at",
            "order_direction": "desc",
        }


@responses.activate
@pytest.mark.parametrize(
    "pagination, status, expected",
    (
        (
            {"page": 1, "page_size": 10},
            200,
            {"count": 10, "previous": None, "next": None, "range": (0, None)},
        ),
        (
            {},
            200,
            {"count": 10, "previous": None, "next": None, "range": (0, None)},
        ),
        (
            {"page": 2, "page_size": 10},
            404,
            {},
        ),
        (
            {"page": 1, "page_size": 5},
            200,
            {
                "count": 10,
                "previous": None,
                "next": {"page": 2, "page_size": 5},
                "range": (0, 5),
            },
        ),
        (
            {"page": 2, "page_size": 5},
            200,
            {
                "count": 10,
                "previous": {"page_size": 5},
                "next": None,
                "range": (5, None),
            },
        ),
        ({"page": 3, "page_size": 5}, 404, {}),
    ),
)
def test_api_documents_search_pagination_endpoint_is_none(
    indexer_settings, pagination, status, expected
):
    """Documents should be ordered by descending "-updated_at" by default"""
    indexer_settings.SEARCH_INDEXER_QUERY_URL = None

    assert get_document_indexer() is None

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(10, title="alpha", users=[user])

    response = client.get(
        "/api/v1.0/documents/search/",
        data={
            "q": "alpha",
            **pagination,
        },
    )

    assert response.status_code == status

    if response.status_code < 300:
        previous_url = (
            build_search_url(q="alpha", **expected["previous"])
            if expected["previous"]
            else None
        )
        next_url = (
            build_search_url(q="alpha", **expected["next"])
            if expected["next"]
            else None
        )
        queryset = models.Document.objects.order_by("-updated_at")
        start, end = expected["range"]
        expected_results = [str(d.pk) for d in queryset[start:end]]

        content = response.json()

        assert content["count"] == expected["count"]
        assert content["previous"] == previous_url
        assert content["next"] == next_url

        results = content.pop("results")

        assert [r["id"] for r in results] == expected_results
