"""
Tests for the MCP-facing API endpoints.

These endpoints reuse `core.api.viewsets.DocumentViewSet`'s queryset/permission logic
(see `core/mcp_api/views.py`), so we mainly assert that the same access rules apply through
the new URLs, plus the audience check specific to the docs-api resource server token.
"""

from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_mcp_documents_search_unauthenticated():
    """A request without a token must be rejected."""
    response = APIClient().post("/api/v1.0/mcp/documents/search", {"query": "doc"})

    assert response.status_code == 401


def test_mcp_documents_search_wrong_audience(
    user_token, resource_server_backend, user_specific_sub, settings
):
    """A token whose audience isn't in OIDC_RS_ALLOWED_AUDIENCES must be rejected."""
    settings.OIDC_RS_ALLOWED_AUDIENCES = ["not-docs-api"]

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
    response = client.post("/api/v1.0/mcp/documents/search", {"query": "doc"})

    assert response.status_code == 403


def test_mcp_documents_search_returns_only_accessible_documents(
    user_token, resource_server_backend, user_specific_sub
):
    """User A's search must only return documents user A can access."""
    accessible = factories.DocumentFactory(
        title="Accessible Alpha Report",
        link_reach=models.LinkReachChoices.RESTRICTED,
    )
    factories.UserDocumentAccessFactory(
        document=accessible, user=user_specific_sub, role=models.RoleChoices.READER
    )
    # Belongs to a different user (user B); user_specific_sub has no access to it.
    factories.DocumentFactory(
        title="Inaccessible Alpha Notes",
        link_reach=models.LinkReachChoices.RESTRICTED,
    )

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
    response = client.post("/api/v1.0/mcp/documents/search", {"query": "Alpha"})

    assert response.status_code == 200
    assert [doc["id"] for doc in response.data] == [str(accessible.id)]
    assert set(response.data[0].keys()) == {
        "id",
        "title",
        "excerpt",
        "updated_at",
        "children_ids",
    }


def test_mcp_documents_read_forbidden_for_other_users_document(
    user_token, resource_server_backend, user_specific_sub
):
    """User A must not be able to read user B's document."""
    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
    response = client.get(f"/api/v1.0/mcp/documents/{document.id!s}")

    assert response.status_code == 403


@patch("core.services.converter_services.YdocConverter.convert")
def test_mcp_documents_read_own_document(
    mock_convert, user_token, resource_server_backend, user_specific_sub
):
    """User A must be able to read a document user A has access to."""
    mock_convert.return_value = "# Hello\n\nWorld"
    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.READER
    )

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
    response = client.get(f"/api/v1.0/mcp/documents/{document.id!s}")

    assert response.status_code == 200
    assert response.data["content"] == "# Hello\n\nWorld"
    assert set(response.data.keys()) == {
        "id",
        "title",
        "content",
        "truncated",
        "updated_at",
    }


def test_mcp_documents_create_forbidden_for_reader(
    user_token, resource_server_backend, user_specific_sub
):
    """A reader must not be allowed to create a document under a parent document."""
    parent = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=parent, user=user_specific_sub, role=models.RoleChoices.READER
    )

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
    response = client.post(
        "/api/v1.0/mcp/documents",
        {"title": "Doc", "content": "Hello", "parent_id": str(parent.id)},
    )

    assert response.status_code == 403


@patch("core.services.converter_services.YdocConverter.convert")
def test_mcp_documents_create_allowed_for_editor(
    mock_convert, user_token, resource_server_backend, user_specific_sub
):
    """An editor must be allowed to create a document under a parent document."""
    mock_convert.return_value = factories.YDOC_HELLO_WORLD_BASE64
    parent = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=parent, user=user_specific_sub, role=models.RoleChoices.EDITOR
    )

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
    response = client.post(
        "/api/v1.0/mcp/documents",
        {"title": "Doc", "content": "Hello", "parent_id": str(parent.id)},
    )

    assert response.status_code == 201
    mock_convert.assert_called_once()
    document = models.Document.objects.get(id=response.data["id"])
    assert document.get_parent().id == parent.id
    assert not models.DocumentAccess.objects.filter(document=document).exists()


@patch("core.services.converter_services.YdocConverter.convert")
def test_mcp_documents_create_root_creates_owner_access(
    mock_convert, user_token, resource_server_backend, user_specific_sub
):
    """Creating a document with no parent creates a root document owned by the caller."""
    mock_convert.return_value = factories.YDOC_HELLO_WORLD_BASE64

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
    response = client.post(
        "/api/v1.0/mcp/documents",
        {"title": "Doc", "content": "Hello"},
    )

    assert response.status_code == 201
    access = models.DocumentAccess.objects.get(document_id=response.data["id"])
    assert access.user == user_specific_sub
    assert access.role == models.RoleChoices.OWNER
