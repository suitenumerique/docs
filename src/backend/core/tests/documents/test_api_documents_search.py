"""
Tests for Documents API endpoint in impress's core app: search
"""

import json
import logging
import time
from unittest import mock

from django.conf import settings as django_settings

import pytest
import requests
import responses
from cryptography.fernet import Fernet
from faker import Faker
from rest_framework.test import APIClient
from waffle.testutils import override_flag

from core import factories
from core.enums import FeatureFlag
from core.models import LinkReachChoices
from core.services.search_indexers import get_document_indexer

fake = Faker()
pytestmark = pytest.mark.django_db

FIND_SEARCH_URL = "http://find/api/v1.0/search"
ENCRYPTION_KEY = Fernet.generate_key().decode()


@pytest.fixture(autouse=True)
def enable_flag_find_full_text_search():
    """Enable flag_find_full_text_search for all tests in this module."""
    with override_flag(FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH, active=True):
        yield


@pytest.fixture(name="find_settings")
def find_settings_fixture(indexer_settings):
    """Configure the Find indexer and the key of the Find tokens of the sessions."""
    indexer_settings.SEARCH_URL = FIND_SEARCH_URL
    indexer_settings.FIND_TOKEN_ENCRYPTION_KEY = ENCRYPTION_KEY
    return indexer_settings


def find_client(user, token="find-token", expires_in=3600, key=ENCRYPTION_KEY):
    """
    Return a client logged in as the user, with the Find token their login
    would have stored in their session.
    """
    client = APIClient()
    client.force_login(user)
    session = client.session
    session["find_access_token"] = Fernet(key).encrypt(token.encode()).decode()
    session["find_access_token_expiration"] = time.time() + expires_in
    session.save()
    return client


@pytest.mark.usefixtures("find_settings")
@mock.patch("core.services.search_indexers.requests.post")
def test_api_documents_search_anonymous(find_post):
    """
    Anonymous users have no Find token: they should search the database, without
    calling Find.
    """
    factories.DocumentFactory(link_reach=LinkReachChoices.PUBLIC, title="alpha")

    response = APIClient().get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    # The database search lists nothing to anonymous users
    assert response.json()["count"] == 0
    assert not find_post.called


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
    with django_assert_num_queries(12):
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
                "parent": {
                    "abilities": parent.get_abilities(user),
                    "ancestors_link_role": None,
                    "ancestors_link_reach": None,
                    "computed_link_reach": parent.computed_link_reach,
                    "computed_link_role": parent.computed_link_role,
                    "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
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
                    "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
                    "user_role": "owner",
                },
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
                "parent": None,
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
                "parent": {
                    "abilities": parent.get_abilities(user),
                    "ancestors_link_role": None,
                    "ancestors_link_reach": None,
                    "computed_link_reach": parent.computed_link_reach,
                    "computed_link_role": parent.computed_link_role,
                    "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
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
                    "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
                    "user_role": "owner",
                },
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
                "parent": {
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
                "parent": None,
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
                "parent": {
                    "abilities": parent.get_abilities(user),
                    "ancestors_link_role": None,
                    "ancestors_link_reach": None,
                    "computed_link_reach": parent.computed_link_reach,
                    "computed_link_role": parent.computed_link_role,
                    "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
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
                    "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
                    "user_role": "owner",
                },
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
                "parent": None,
            },
        ],
    }


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
def test_api_documents_search_success(find_settings):
    """
    The search should be sent to Find with the Find token of the session, in the
    services configured, and answer the documents found as Find lists them.
    """
    find_settings.FIND_SEARCH_SERVICES = ["docs-development"]
    assert get_document_indexer() is not None

    document = {
        "id": "doc-123",
        "service": "docs",
        "title": "alpha",
        "score": 2.3,
        "path": "000000010000002",
        "depth": 2,
        "numchild": 0,
        "size": 42,
        "created_at": "2026-10-01T10:00:00Z",
        "updated_at": "2026-10-02T10:00:00Z",
        "reach": "public",
        "tags": [],
    }

    # Find response
    responses.add(
        responses.POST,
        FIND_SEARCH_URL,
        json={"results": [document]},
        status=200,
    )
    user = factories.UserFactory()
    response = find_client(user).get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    content = response.json()
    results = content.pop("results")
    assert content == {
        "count": 1,
        "next": None,
        "previous": None,
    }
    assert results == [document]

    assert len(responses.calls) == 1
    find_request = responses.calls[0].request
    assert find_request.headers["Authorization"] == "Bearer find-token"
    assert json.loads(find_request.body) == {
        "q": "alpha",
        "visited": [],
        "services": ["docs-development"],
        "nb_results": 50,
        "order_by": "updated_at",
        "order_direction": "desc",
        "path": None,
    }


def test_api_documents_search_find_services_default():
    """The default services are the name documented by Find for Docs."""
    assert django_settings.FIND_SEARCH_SERVICES == ["docs"]


@pytest.mark.parametrize(
    "token_kind",
    ["missing", "expired", "encrypted-with-another-key"],
)
@pytest.mark.usefixtures("find_settings")
@mock.patch("core.services.search_indexers.requests.post")
def test_api_documents_search_without_a_usable_find_token(find_post, token_kind):
    """
    A session without a usable Find token (Menshen failing at login, flag granted
    since the login, key rotated...) should search the database without calling Find.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")], title="alpha")
    if token_kind == "missing":
        client = APIClient()
        client.force_login(user)
    elif token_kind == "expired":
        client = find_client(user, expires_in=-1)
    else:
        client = find_client(user, key=Fernet.generate_key().decode())

    response = client.get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    assert [result["id"] for result in response.json()["results"]] == [str(document.id)]
    assert not find_post.called


@pytest.mark.parametrize("reason", ["flag-inactive", "indexer-not-configured"])
@mock.patch("core.services.search_indexers.requests.post")
def test_api_documents_search_find_not_used(find_post, reason, find_settings):
    """
    Without the flag or the Find indexer, the search should be made in the database,
    even with a Find token in the session: both are checked at each search.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")], title="alpha")
    if reason == "indexer-not-configured":
        find_settings.SEARCH_INDEXER_CLASS = None
        get_document_indexer.cache_clear()

    with override_flag(
        FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH, active=reason != "flag-inactive"
    ):
        client = find_client(user)
        response = client.get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    assert [result["id"] for result in response.json()["results"]] == [str(document.id)]
    assert not find_post.called


@pytest.mark.parametrize(
    "find_answer",
    [
        pytest.param({"body": requests.ConnectionError("refused")}, id="unreachable"),
        pytest.param({"body": requests.Timeout("too slow")}, id="timeout"),
        pytest.param({"status": 400, "json": {"detail": "Invalid request."}}, id="400"),
        pytest.param(
            {"status": 403, "json": {"detail": "You do not have permission."}},
            id="403",
        ),
        pytest.param({"status": 500, "body": "Internal Server Error"}, id="500"),
        pytest.param(
            {"status": 503, "json": {"detail": "The authentication service..."}},
            id="503",
        ),
        pytest.param({"status": 200, "body": "<html></html>"}, id="not-json"),
        pytest.param({"status": 200, "json": {"detail": "?"}}, id="no-results"),
        pytest.param({"status": 200, "json": ["alpha"]}, id="not-an-object"),
    ],
)
@pytest.mark.usefixtures("find_settings")
@responses.activate
def test_api_documents_search_find_failing(find_answer, caplog):
    """
    Whatever the failure of Find, the user should get the results of the database
    search, and keep their Find token for the next searches.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")], title="alpha")
    responses.add(responses.POST, FIND_SEARCH_URL, **find_answer)
    client = find_client(user)

    with caplog.at_level(logging.ERROR, logger="core.api.viewsets"):
        response = client.get("/api/v1.0/documents/search/", data={"q": "alpha"})

    assert response.status_code == 200
    assert [result["id"] for result in response.json()["results"]] == [str(document.id)]
    assert len(responses.calls) == 1
    assert "Error while searching documents with indexer" in caplog.text
    # The query of the user is not logged
    assert "alpha" not in caplog.text
    assert "find_access_token" in client.session


@pytest.mark.usefixtures("find_settings")
@responses.activate
def test_api_documents_search_find_rejecting_the_token(caplog):
    """
    A token Find rejects (revoked, expired at Menshen) should be dropped from the
    session, and the database searched: it is not sent again.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")], title="alpha")
    responses.add(
        responses.POST, FIND_SEARCH_URL, status=401, json={"detail": "Invalid token."}
    )
    client = find_client(user)

    for _ in range(2):
        with caplog.at_level(logging.WARNING, logger="core.api.viewsets"):
            response = client.get("/api/v1.0/documents/search/", data={"q": "alpha"})

        assert response.status_code == 200
        assert [result["id"] for result in response.json()["results"]] == [
            str(document.id)
        ]

    assert len(responses.calls) == 1
    assert "Find rejected the token of the session (401)" in caplog.text
    assert "find_access_token" not in client.session
    assert "find_access_token_expiration" not in client.session


@pytest.mark.usefixtures("find_settings")
@mock.patch("core.services.search_indexers.FindDocumentIndexer.search_query")
def test_api_documents_search_indexer_in_document(search_query):
    """
    Searching in a document through the indexer should restrict the search to the
    descendants of the document, by its path.
    """
    search_query.return_value = {"results": []}

    user = factories.UserFactory()
    client = find_client(user)

    parent = factories.DocumentFactory(users=[user])

    response = client.get(
        "/api/v1.0/documents/search/", data={"q": "alpha", "document": parent.id}
    )

    assert response.status_code == 200
    assert search_query.call_args.kwargs["data"]["path"] == parent.path


@pytest.mark.usefixtures("find_settings")
@mock.patch("core.services.search_indexers.FindDocumentIndexer.search_query")
def test_api_documents_search_indexer_in_unknown_document(search_query):
    """Searching through the indexer in a document that does not exist is a 404."""
    user = factories.UserFactory()
    client = find_client(user)

    response = client.get(
        "/api/v1.0/documents/search/",
        data={"q": "alpha", "document": fake.uuid4()},
    )

    assert response.status_code == 404
    assert not search_query.called
