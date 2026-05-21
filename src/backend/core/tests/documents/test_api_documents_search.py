"""
Tests for Documents API endpoint in impress's core app: search
"""

from unittest import mock

import pytest
import responses
from faker import Faker
from rest_framework import response as drf_response
from rest_framework.test import APIClient
from waffle.testutils import override_flag

from core import factories
from core.enums import FeatureFlag, SearchType
from core.models import LinkReachChoices
from core.services.search_indexers import get_document_indexer

fake = Faker()
pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def enable_flag_find_hybrid_search():
    """Enable flag_find_hybrid_search for all tests in this module."""
    with override_flag(FeatureFlag.FLAG_FIND_HYBRID_SEARCH, active=True):
        yield


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
            "search_type": SearchType.HYBRID,
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


def test_api_documents_search_simple_search_anonymous(settings):
    """Anonymous users should not be able to use the global search."""
    assert get_document_indexer() is None
    assert settings.OIDC_STORE_REFRESH_TOKEN is False
    assert settings.OIDC_STORE_ACCESS_TOKEN is False

    factories.DocumentFactory(link_reach=LinkReachChoices.PUBLIC, title="alpha")
    parent = factories.DocumentFactory(link_reach=LinkReachChoices.PUBLIC)
    factories.DocumentFactory.create_batch(3, parent=parent, title="alpha")

    client = APIClient()
    q = "alpha"
    response = client.get("/api/v1.0/documents/search/", data={"q": q})

    assert response.status_code == 200
    assert response.json()["count"] == 0


def test_api_documents_search_fall_back_on_simple_search(
    settings, django_assert_num_queries
):
    """
    When indexer is not configured the search should be made in the database on the
    title field.
    """
    assert get_document_indexer() is None
    assert settings.OIDC_STORE_REFRESH_TOKEN is False
    assert settings.OIDC_STORE_ACCESS_TOKEN is False

    user = factories.UserFactory()

    document = factories.DocumentFactory(
        creator=user, users=[(user, "owner")], title="alpha"
    )
    factories.DocumentFactory(creator=user, users=[(user, "owner")], title="bar")

    # return a matching doc in a tree
    parent = factories.DocumentFactory(
        creator=user, users=[(user, "owner")], title="top parent"
    )
    child = factories.DocumentFactory(parent=parent, title="alpha blondy")
    child_to_delete = factories.DocumentFactory(parent=parent, title="deleted alpha")
    child_to_delete.soft_delete()

    deleted_parent = factories.DocumentFactory(creator=user, users=[(user, "owner")])
    factories.DocumentFactory.create_batch(3, parent=deleted_parent, title="alpha")

    deleted_parent.soft_delete()

    # not reachable documents for the current user
    factories.DocumentFactory(title="alpha", link_reach=LinkReachChoices.AUTHENTICATED)
    factories.DocumentFactory(title="alpha foo", link_reach=LinkReachChoices.PUBLIC)

    client = APIClient()
    client.force_login(user)

    q = "alpha"
    with django_assert_num_queries(13):
        response = client.get("/api/v1.0/documents/search/", data={"q": q})

    assert response.status_code == 200

    # all `nb_access_*` should be in cache
    with django_assert_num_queries(6):
        response = client.get("/api/v1.0/documents/search/", data={"q": q})

    assert response.status_code == 200

    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": child.get_abilities(user),
                "ancestors_link_reach": child.ancestors_link_reach,
                "ancestors_link_role": child.ancestors_link_role,
                "computed_link_reach": child.computed_link_reach,
                "computed_link_role": child.computed_link_role,
                "created_at": child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child.excerpt,
                "id": str(child.id),
                "is_favorite": False,
                "link_reach": child.link_reach,
                "link_role": child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": child.nb_accesses_ancestors,
                "nb_accesses_direct": child.nb_accesses_direct,
                "path": child.path,
                "title": child.title,
                "updated_at": child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": "owner",
                "parents": [
                    {
                        "abilities": parent.get_abilities(user),
                        "ancestors_link_role": None,
                        "ancestors_link_reach": None,
                        "computed_link_reach": parent.computed_link_reach,
                        "computed_link_role": parent.computed_link_role,
                        "created_at": parent.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(parent.creator.id),
                        "deleted_at": None,
                        "depth": 1,
                        "excerpt": parent.excerpt,
                        "id": str(parent.id),
                        "is_favorite": False,
                        "link_reach": parent.link_reach,
                        "link_role": parent.link_role,
                        "numchild": 1,
                        "nb_accesses_ancestors": parent.nb_accesses_ancestors,
                        "nb_accesses_direct": parent.nb_accesses_direct,
                        "path": parent.path,
                        "title": parent.title,
                        "updated_at": parent.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": "owner",
                    },
                ],
            },
            {
                "abilities": document.get_abilities(user),
                "ancestors_link_role": None,
                "ancestors_link_reach": None,
                "computed_link_reach": document.computed_link_reach,
                "computed_link_role": document.computed_link_role,
                "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(document.creator.id),
                "deleted_at": None,
                "depth": 1,
                "excerpt": document.excerpt,
                "id": str(document.id),
                "is_favorite": False,
                "link_reach": document.link_reach,
                "link_role": document.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": document.nb_accesses_ancestors,
                "nb_accesses_direct": document.nb_accesses_direct,
                "path": document.path,
                "title": document.title,
                "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": "owner",
                "parents": [],
            },
        ],
    }


def test_api_documents_search_simple_search_only_match_in_depth(settings):
    """Test with results only matching documents in depth."""
    assert get_document_indexer() is None
    assert settings.OIDC_STORE_REFRESH_TOKEN is False
    assert settings.OIDC_STORE_ACCESS_TOKEN is False

    user = factories.UserFactory()

    document = factories.DocumentFactory(creator=user, users=[(user, "owner")])
    subdocument = factories.DocumentFactory(parent=document, title="alpha")

    factories.DocumentFactory(creator=user, users=[(user, "owner")], title="bar")

    # return a matching doc in a tree
    parent = factories.DocumentFactory(
        creator=user, users=[(user, "owner")], title="top parent"
    )
    child = factories.DocumentFactory(parent=parent, title="alpha blondy")
    child_to_delete = factories.DocumentFactory(parent=parent, title="deleted alpha")
    child_to_delete.soft_delete()

    deleted_parent = factories.DocumentFactory(creator=user, users=[(user, "owner")])
    factories.DocumentFactory.create_batch(3, parent=deleted_parent, title="alpha")

    deleted_parent.soft_delete()

    # not reachable documents for the current user
    factories.DocumentFactory(title="alpha", link_reach=LinkReachChoices.AUTHENTICATED)
    factories.DocumentFactory(title="alpha foo", link_reach=LinkReachChoices.PUBLIC)

    client = APIClient()
    client.force_login(user)

    q = "alpha"
    response = client.get("/api/v1.0/documents/search/", data={"q": q})

    assert response.status_code == 200

    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": child.get_abilities(user),
                "ancestors_link_reach": child.ancestors_link_reach,
                "ancestors_link_role": child.ancestors_link_role,
                "computed_link_reach": child.computed_link_reach,
                "computed_link_role": child.computed_link_role,
                "created_at": child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child.excerpt,
                "id": str(child.id),
                "is_favorite": False,
                "link_reach": child.link_reach,
                "link_role": child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": child.nb_accesses_ancestors,
                "nb_accesses_direct": child.nb_accesses_direct,
                "path": child.path,
                "title": child.title,
                "updated_at": child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": "owner",
                "parents": [
                    {
                        "abilities": parent.get_abilities(user),
                        "ancestors_link_role": None,
                        "ancestors_link_reach": None,
                        "computed_link_reach": parent.computed_link_reach,
                        "computed_link_role": parent.computed_link_role,
                        "created_at": parent.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(parent.creator.id),
                        "deleted_at": None,
                        "depth": 1,
                        "excerpt": parent.excerpt,
                        "id": str(parent.id),
                        "is_favorite": False,
                        "link_reach": parent.link_reach,
                        "link_role": parent.link_role,
                        "numchild": 1,
                        "nb_accesses_ancestors": parent.nb_accesses_ancestors,
                        "nb_accesses_direct": parent.nb_accesses_direct,
                        "path": parent.path,
                        "title": parent.title,
                        "updated_at": parent.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": "owner",
                    },
                ],
            },
            {
                "abilities": subdocument.get_abilities(user),
                "ancestors_link_role": subdocument.ancestors_link_role,
                "ancestors_link_reach": subdocument.ancestors_link_reach,
                "computed_link_reach": subdocument.computed_link_reach,
                "computed_link_role": subdocument.computed_link_role,
                "created_at": subdocument.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(subdocument.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": subdocument.excerpt,
                "id": str(subdocument.id),
                "is_favorite": False,
                "link_reach": subdocument.link_reach,
                "link_role": subdocument.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": subdocument.nb_accesses_ancestors,
                "nb_accesses_direct": subdocument.nb_accesses_direct,
                "path": subdocument.path,
                "title": subdocument.title,
                "updated_at": subdocument.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": "owner",
                "parents": [
                    {
                        "abilities": document.get_abilities(user),
                        "ancestors_link_role": None,
                        "ancestors_link_reach": None,
                        "computed_link_reach": document.computed_link_reach,
                        "computed_link_role": document.computed_link_role,
                        "created_at": document.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(document.creator.id),
                        "deleted_at": None,
                        "depth": 1,
                        "excerpt": document.excerpt,
                        "id": str(document.id),
                        "is_favorite": False,
                        "link_reach": document.link_reach,
                        "link_role": document.link_role,
                        "numchild": 1,
                        "nb_accesses_ancestors": document.nb_accesses_ancestors,
                        "nb_accesses_direct": document.nb_accesses_direct,
                        "path": document.path,
                        "title": document.title,
                        "updated_at": document.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": "owner",
                    },
                ],
            },
        ],
    }


def test_api_documents_search_with_title_also_matching_link_traces(settings):
    """Test that link_traces can also be present in the search result."""
    assert get_document_indexer() is None
    assert settings.OIDC_STORE_REFRESH_TOKEN is False
    assert settings.OIDC_STORE_ACCESS_TOKEN is False

    user = factories.UserFactory()

    document = factories.DocumentFactory(
        creator=user, users=[(user, "owner")], title="alpha"
    )
    factories.DocumentFactory(creator=user, users=[(user, "owner")], title="bar")

    # return a matching doc in a tree
    parent = factories.DocumentFactory(
        creator=user, users=[(user, "owner")], title="top parent"
    )
    child = factories.DocumentFactory(parent=parent, title="alpha blondy")
    child_to_delete = factories.DocumentFactory(parent=parent, title="deleted alpha")
    child_to_delete.soft_delete()

    deleted_parent = factories.DocumentFactory(creator=user, users=[(user, "owner")])
    factories.DocumentFactory.create_batch(3, parent=deleted_parent, title="alpha")

    deleted_parent.soft_delete()

    # Document reachable through link_traces
    document_link_trace = factories.DocumentFactory(
        link_reach=LinkReachChoices.AUTHENTICATED,
        link_traces=[user],
        title="too much alpha",
    )

    # not reachable documents for the current user
    factories.DocumentFactory(title="alpha", link_reach=LinkReachChoices.AUTHENTICATED)
    factories.DocumentFactory(title="alpha foo", link_reach=LinkReachChoices.PUBLIC)

    client = APIClient()
    client.force_login(user)

    q = "alpha"
    response = client.get("/api/v1.0/documents/search/", data={"q": q})

    assert response.status_code == 200

    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": document_link_trace.get_abilities(user),
                "ancestors_link_role": None,
                "ancestors_link_reach": None,
                "computed_link_reach": document_link_trace.computed_link_reach,
                "computed_link_role": document_link_trace.computed_link_role,
                "created_at": document_link_trace.created_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "creator": str(document_link_trace.creator.id),
                "deleted_at": None,
                "depth": 1,
                "excerpt": document_link_trace.excerpt,
                "id": str(document_link_trace.id),
                "is_favorite": False,
                "link_reach": document_link_trace.link_reach,
                "link_role": document_link_trace.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": document_link_trace.nb_accesses_ancestors,
                "nb_accesses_direct": document_link_trace.nb_accesses_direct,
                "path": document_link_trace.path,
                "title": document_link_trace.title,
                "updated_at": document_link_trace.updated_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "user_role": None,
                "parents": [],
            },
            {
                "abilities": child.get_abilities(user),
                "ancestors_link_reach": child.ancestors_link_reach,
                "ancestors_link_role": child.ancestors_link_role,
                "computed_link_reach": child.computed_link_reach,
                "computed_link_role": child.computed_link_role,
                "created_at": child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child.excerpt,
                "id": str(child.id),
                "is_favorite": False,
                "link_reach": child.link_reach,
                "link_role": child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": child.nb_accesses_ancestors,
                "nb_accesses_direct": child.nb_accesses_direct,
                "path": child.path,
                "title": child.title,
                "updated_at": child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": "owner",
                "parents": [
                    {
                        "abilities": parent.get_abilities(user),
                        "ancestors_link_role": None,
                        "ancestors_link_reach": None,
                        "computed_link_reach": parent.computed_link_reach,
                        "computed_link_role": parent.computed_link_role,
                        "created_at": parent.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(parent.creator.id),
                        "deleted_at": None,
                        "depth": 1,
                        "excerpt": parent.excerpt,
                        "id": str(parent.id),
                        "is_favorite": False,
                        "link_reach": parent.link_reach,
                        "link_role": parent.link_role,
                        "numchild": 1,
                        "nb_accesses_ancestors": parent.nb_accesses_ancestors,
                        "nb_accesses_direct": parent.nb_accesses_direct,
                        "path": parent.path,
                        "title": parent.title,
                        "updated_at": parent.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": "owner",
                    },
                ],
            },
            {
                "abilities": document.get_abilities(user),
                "ancestors_link_role": None,
                "ancestors_link_reach": None,
                "computed_link_reach": document.computed_link_reach,
                "computed_link_role": document.computed_link_role,
                "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(document.creator.id),
                "deleted_at": None,
                "depth": 1,
                "excerpt": document.excerpt,
                "id": str(document.id),
                "is_favorite": False,
                "link_reach": document.link_reach,
                "link_role": document.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": document.nb_accesses_ancestors,
                "nb_accesses_direct": document.nb_accesses_direct,
                "path": document.path,
                "title": document.title,
                "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": "owner",
                "parents": [],
            },
        ],
    }


@mock.patch("core.api.viewsets.DocumentViewSet._search_using_database")
def test_api_documents_search_indexer_crashes(
    mock_search_using_database, indexer_settings
):
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
    client.force_login(
        user, backend="core.authentication.backends.OIDCAuthenticationBackend"
    )

    mocked_response = {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [{"title": "mocked title_search result"}],
    }
    mock_search_using_database.return_value = drf_response.Response(mocked_response)

    parent = factories.DocumentFactory(title="parent", users=[user])
    q = "alpha"
    response = client.get(
        "/api/v1.0/documents/search/", data={"q": "alpha", "path": parent.path}
    )

    # the search endpoint did not crash
    assert response.status_code == 200
    # fallback on title_search
    assert mock_search_using_database.call_count == 1
    assert mock_search_using_database.call_args[0][0].GET.get("q") == q
    assert mock_search_using_database.call_args[0][0].GET.get("path") == parent.path
    assert response.json() == mocked_response


@responses.activate
def test_api_documents_search_invalid_params(indexer_settings):
    """Validate the format of documents as returned by the search view."""
    indexer_settings.SEARCH_URL = "http://find/api/v1.0/search"
    assert get_document_indexer() is not None

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(
        user, backend="core.authentication.backends.OIDCAuthenticationBackend"
    )

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
