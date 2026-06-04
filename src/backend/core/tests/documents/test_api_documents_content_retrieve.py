"""
Tests for the GET /api/v1.0/documents/{id}/content/ endpoint.
"""

from datetime import timedelta
from uuid import uuid4

from django.core.cache import cache
from django.core.files.storage import default_storage
from django.utils import timezone

import pytest
from asgiref.sync import sync_to_async
from rest_framework import status
from rest_framework.test import APIClient

from core import factories
from core.api.utils import get_content_metadata_cache_key
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("reach", ["authenticated", "restricted"])
def test_api_documents_content_retrieve_anonymous_non_public(reach):
    """Anonymous users cannot retrieve content of non-public documents."""
    document = factories.DocumentFactory(link_reach=reach)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_api_documents_content_retrieve_anonymous_public():
    """Anonymous users can retrieve content of a public document."""
    document = factories.DocumentFactory(link_reach="public")

    assert not cache.get(get_content_metadata_cache_key(document.id))

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_200_OK
    assert response["Content-Type"] == "text/plain"
    assert b"".join(
        response.streaming_content
    ) == factories.YDOC_HELLO_WORLD_BASE64.encode("utf-8")
    assert response["Content-Length"] is not None
    assert response["ETag"] is not None
    assert response["Last-Modified"] is not None
    assert response["Cache-Control"] == "private, no-cache"

    assert cache.get(get_content_metadata_cache_key(document.id))


def test_api_documents_content_retrieve_authenticated_no_access():
    """Authenticated users without access cannot retrieve content of a restricted document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.parametrize("link_reach", ["authenticated", "public"])
def test_api_documents_content_retrieve_authenticated_not_restricted(link_reach):
    """
    Authenticated users can retrieve content of a public document
    without any explicit access grant.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach=link_reach)

    client = APIClient()
    client.force_login(user)

    assert not cache.get(get_content_metadata_cache_key(document.id))

    response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_200_OK
    assert b"".join(
        response.streaming_content
    ) == factories.YDOC_HELLO_WORLD_BASE64.encode("utf-8")
    assert response["Content-Length"] is not None
    assert response["ETag"] is not None
    assert response["Last-Modified"] is not None
    assert response["Cache-Control"] == "private, no-cache"

    assert cache.get(get_content_metadata_cache_key(document.id))


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize(
    "role", ["reader", "commenter", "editor", "administrator", "owner"]
)
def test_api_documents_content_retrieve_success(role, via, mock_user_teams):
    """Users with any role can retrieve document content, directly or via a team."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")

    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    client = APIClient()
    client.force_login(user)

    assert not cache.get(get_content_metadata_cache_key(document.id))

    response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_200_OK
    assert b"".join(
        response.streaming_content
    ) == factories.YDOC_HELLO_WORLD_BASE64.encode("utf-8")
    assert response["Content-Length"] is not None
    assert response["ETag"] is not None
    assert response["Last-Modified"] is not None
    assert response["Cache-Control"] == "private, no-cache"

    assert cache.get(get_content_metadata_cache_key(document.id))


def test_api_documents_content_retrieve_nonexistent_document():
    """Retrieving content of a non-existent document returns 404."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{uuid4()!s}/content/")

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_api_documents_content_retrieve_file_not_in_storage():
    """Returns an empty string when the file does not exists on the storage."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="reader")

    client = APIClient()
    client.force_login(user)

    default_storage.delete(document.file_key)

    assert not default_storage.exists(document.file_key)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_200_OK
    assert b"".join(response.streaming_content) == b""
    assert not response.get("Content-Length")
    assert not response.get("ETag")
    assert not response.get("Last-Modified")
    assert not response.get("Cache-Control")

    assert not cache.get(get_content_metadata_cache_key(document.id))


# The data created in this test through `sync_to_async` is written on a
# separate thread-local database connection, outside the atomic transaction
# pytest-django uses to isolate tests. `transaction=True` makes pytest-django
# flush the tables after the test instead of relying on a rollback, so the row
# does not leak into the rest of the suite.
@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio(loop_scope="function")
async def test_api_documents_content_retrieve_async(monkeypatch):
    """
    Test the content retrieve method in async should use the async generator in the streaming
    response.
    """
    monkeypatch.setenv("PYTHON_SERVER_MODE", "async")

    document = await sync_to_async(factories.DocumentFactory)(link_reach="public")
    client = APIClient()

    response = await sync_to_async(client.get)(
        f"/api/v1.0/documents/{document.id!s}/content/"
    )

    assert response.status_code == status.HTTP_200_OK
    # Wait for the streaming content to be fully received => async iterator -> list
    # This fails it the streaming is not an async generator
    response_content = b"".join(
        [content async for content in response.streaming_content]
    ).decode("utf-8")
    assert response_content == factories.YDOC_HELLO_WORLD_BASE64


def test_api_documents_content_retrieve_content_length_header():
    """The response includes the Content-Length header when available from storage."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="reader")

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_200_OK
    expected_size = default_storage.size(document.file_key)
    assert int(response["Content-Length"]) == expected_size


@pytest.mark.parametrize("role", ["reader", "commenter", "editor", "administrator"])
def test_api_documents_content_retrieve_deleted_document_for_non_owners_all_roles(role):
    """
    Retrieving content of a soft-deleted document returns 404 for any non-owner role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role=role)

    document.soft_delete()
    document.refresh_from_db()

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_api_documents_content_retrieve_deleted_document_for_owner():
    """
    Owners can still retrieve content of a soft-deleted document.

    The 'retrieve' ability is True for owners regardless of deletion state.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    document.soft_delete()
    document.refresh_from_db()

    client = APIClient()
    client.force_login(user)

    assert not cache.get(get_content_metadata_cache_key(document.id))

    response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_200_OK
    assert b"".join(
        response.streaming_content
    ) == factories.YDOC_HELLO_WORLD_BASE64.encode("utf-8")
    assert response["Content-Length"] is not None
    assert response["ETag"] is not None
    assert response["Last-Modified"] is not None
    assert response["Cache-Control"] == "private, no-cache"

    assert cache.get(get_content_metadata_cache_key(document.id))


def test_api_documents_content_retrieve_reusing_etag():
    """Fetching content reusing a valid ETag header should return a 304."""

    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    client = APIClient()
    client.force_login(user)

    file_metadata = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=document.file_key
    )
    last_modified = file_metadata["LastModified"]
    etag = file_metadata["ETag"]
    size = file_metadata["ContentLength"]

    cache.set(
        get_content_metadata_cache_key(document.id),
        {
            "last_modified": last_modified.isoformat(),
            "etag": etag,
            "size": size,
        },
    )

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/content/",
        headers={"If-None-Match": etag},
    )

    assert response.status_code == status.HTTP_304_NOT_MODIFIED


def test_api_documents_content_retrieve_reusing_invalid_etag():
    """Fetching content using an invalid ETag header should return a 200."""

    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    client = APIClient()
    client.force_login(user)

    file_metadata = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=document.file_key
    )
    last_modified = file_metadata["LastModified"]
    etag = file_metadata["ETag"]
    size = file_metadata["ContentLength"]

    cache.set(
        get_content_metadata_cache_key(document.id),
        {
            "last_modified": last_modified.isoformat(),
            "etag": etag,
            "size": size,
        },
    )

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/content/",
        headers={"If-None-Match": "invalid"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert b"".join(
        response.streaming_content
    ) == factories.YDOC_HELLO_WORLD_BASE64.encode("utf-8")
    assert response["Content-Length"] is not None
    assert response["ETag"] is not None
    assert response["Last-Modified"] is not None
    assert response["Cache-Control"] == "private, no-cache"


def test_api_documents_content_retrieve_using_etag_without_cache():
    """
    Fetching content using a valid ETag header but without existing cache should return a 304.
    """

    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    client = APIClient()
    client.force_login(user)

    file_metadata = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=document.file_key
    )
    etag = file_metadata["ETag"]

    assert not cache.get(get_content_metadata_cache_key(document.id))

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/content/",
        headers={"If-None-Match": etag},
    )

    assert response.status_code == status.HTTP_304_NOT_MODIFIED


def test_api_documents_content_retrieve_reusing_last_modified_since():
    """Fetching a content using a If-Modified-Since valid should return a 304."""

    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    client = APIClient()
    client.force_login(user)

    file_metadata = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=document.file_key
    )
    last_modified = file_metadata["LastModified"]
    etag = file_metadata["ETag"]
    size = file_metadata["ContentLength"]

    cache.set(
        get_content_metadata_cache_key(document.id),
        {
            "last_modified": last_modified.isoformat(),
            "etag": etag,
            "size": size,
        },
    )

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/content/",
        headers={
            "If-Modified-Since": timezone.now().strftime("%a, %d %b %Y %H:%M:%S %Z")
        },
    )

    assert response.status_code == status.HTTP_304_NOT_MODIFIED


def test_api_documents_content_retrieve_using_last_modified_since_without_cache():
    """
    Fetching a content using a If-Modified-Since valid should return a 304
    even if content metadata are not present in cache.
    """

    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    client = APIClient()
    client.force_login(user)

    assert not cache.get(get_content_metadata_cache_key(document.id))

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/content/",
        headers={
            "If-Modified-Since": timezone.now().strftime("%a, %d %b %Y %H:%M:%S %Z")
        },
    )

    assert response.status_code == status.HTTP_304_NOT_MODIFIED


def test_api_documents_content_retrieve_reusing_last_modified_since_invalid():
    """Fetching a content using a If-Modified-Since invalid should return a 200."""

    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    client = APIClient()
    client.force_login(user)

    file_metadata = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=document.file_key
    )
    last_modified = file_metadata["LastModified"]
    etag = file_metadata["ETag"]
    size = file_metadata["ContentLength"]

    cache.set(
        get_content_metadata_cache_key(document.id),
        {
            "last_modified": last_modified.isoformat(),
            "etag": etag,
            "size": size,
        },
    )

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/content/",
        headers={
            "If-Modified-Since": (timezone.now() - timedelta(minutes=60)).strftime(
                "%a, %d %b %Y %H:%M:%S %Z"
            )
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert b"".join(
        response.streaming_content
    ) == factories.YDOC_HELLO_WORLD_BASE64.encode("utf-8")
    assert response["Content-Length"] is not None
    assert response["ETag"] is not None
    assert response["Last-Modified"] is not None
    assert response["Cache-Control"] == "private, no-cache"
