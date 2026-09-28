"""
Tests for the PATCH /api/v1.0/documents/{id}/content/ endpoint.
"""

import base64
from functools import cache
from uuid import uuid4

from django.core.cache import cache as django_cache
from django.core.files.storage import default_storage

import pycrdt
import pytest
import responses
from rest_framework import status
from rest_framework.test import APIClient

from core import factories, models
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


@cache
def get_sample_ydoc():
    """Return a ydoc from text for testing purposes."""
    ydoc = pycrdt.Doc()
    ydoc["document-store"] = pycrdt.Text("Hello")
    update = ydoc.get_update()
    return base64.b64encode(update).decode("utf-8")


def get_s3_content(document):
    """Read the raw content currently stored in S3 for the given document."""
    with default_storage.open(document.file_key, mode="rb") as file:
        return file.read().decode()


def test_api_documents_content_update_anonymous():
    """Anonymous users without access cannot update document content."""
    document = factories.DocumentFactory(link_reach="restricted")

    response = APIClient().patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc()},
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_api_documents_content_update_authenticated_no_access():
    """Authenticated users without access cannot update document content."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")

    client = APIClient()
    client.force_login(user)

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc()},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.parametrize("role", ["reader", "commenter"])
def test_api_documents_content_update_read_only_role(role):
    """Users with reader or commenter role cannot update document content."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role=role)

    client = APIClient()
    client.force_login(user)

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc()},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
def test_api_documents_content_update_success(role, via, mock_user_teams):
    """Users with editor, administrator, or owner role can update document content."""
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

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": True},
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert get_s3_content(document) == get_sample_ydoc()


def test_api_documents_content_update_missing_content_field():
    """A request body without the content field returns 400."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="editor")

    client = APIClient()
    client.force_login(user)

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "content": [
            "This field is required.",
        ]
    }


def test_api_documents_content_update_invalid_base64():
    """A non-base64 content value returns 400."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="editor")

    client = APIClient()
    client.force_login(user)

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": "not-valid-base64!!!"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "content": [
            "Invalid base64 content.",
        ]
    }


def test_api_documents_content_update_nonexistent_document():
    """Updating the content of a non-existent document returns 404."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.patch(
        f"/api/v1.0/documents/{uuid4()!s}/content/",
        {"content": get_sample_ydoc()},
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_api_documents_content_update_replaces_existing():
    """Patching content replaces whatever was previously in S3."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="editor")

    client = APIClient()
    client.force_login(user)

    assert get_s3_content(document) == factories.YDOC_HELLO_WORLD_BASE64

    new_content = get_sample_ydoc()
    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": new_content, "websocket": True},
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert get_s3_content(document) == new_content


@pytest.mark.parametrize("role", ["editor", "administrator"])
def test_api_documents_content_update_deleted_document_for_non_owners(role):
    """Updating content on a soft-deleted document returns 404 for non-owners.

    Soft-deleted documents are excluded from the queryset for non-owners,
    so the endpoint returns 404 rather than 403.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role=role)

    document.soft_delete()
    document.refresh_from_db()

    client = APIClient()
    client.force_login(user)

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc()},
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_api_documents_content_update_deleted_document_for_owners():
    """Updating content on a soft-deleted document returns 403 for owners."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    document.soft_delete()
    document.refresh_from_db()

    client = APIClient()
    client.force_login(user)

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc()},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_api_documents_content_update_link_editor():
    """
    A public document with link_role=editor allows any authenticated user to
    update content via the link role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    client = APIClient()
    client.force_login(user)

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": True},
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert get_s3_content(document) == get_sample_ydoc()
    assert models.Document.objects.filter(id=document.id).exists()


@responses.activate
def test_api_documents_content_update_authenticated_no_websocket(settings):
    """
    When a user updates the document content, not connected to the websocket and is the first
    to update, the content should be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 0, "exists": False})

    assert django_cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": False},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert get_s3_content(document) == get_sample_ydoc()
    assert django_cache.get(f"docs:no-websocket:{document.id}") == session_key
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_content_update_authenticated_no_websocket_user_already_editing(
    settings,
):
    """
    When a user updates the document content, not connected to the websocket and another session
    is already editing, the update should be denied.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 0, "exists": False})

    django_cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": False},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "You are not allowed to edit this document."}
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_content_update_no_websocket_other_user_connected_to_websocket(
    settings,
):
    """
    When a user updates document content without websocket and another user is connected
    to the websocket, the update should be denied.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 3, "exists": False})

    assert django_cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": False},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "You are not allowed to edit this document."}
    assert django_cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_content_update_user_connected_to_websocket(settings):
    """
    When a user updates document content and is connected to the websocket,
    the content should be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 3, "exists": True})

    assert django_cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": False},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert get_s3_content(document) == get_sample_ydoc()
    assert django_cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_content_update_websocket_server_unreachable_fallback_to_no_websocket(
    settings,
):
    """
    When the websocket server is unreachable, the content should be updated like if the user
    was not connected to the websocket.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    assert django_cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": False},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert get_s3_content(document) == get_sample_ydoc()
    assert django_cache.get(f"docs:no-websocket:{document.id}") == session_key
    assert ws_resp.call_count == 1


@responses.activate
def test_api_content_update_websocket_server_unreachable_fallback_to_no_websocket_other_users(
    settings,
):
    """
    When the websocket server is unreachable, the behavior fallback to the no websocket one.
    If another user is already editing, the content update should be denied.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    django_cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": False},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert django_cache.get(f"docs:no-websocket:{document.id}") == "other_session_key"
    assert ws_resp.call_count == 1


@responses.activate
def test_api_content_update_websocket_server_room_not_found_fallback_to_no_websocket_other_users(
    settings,
):
    """
    When the WebSocket server does not have the room created, the logic should fallback to
    no-WebSocket. If another user is already editing, the update must be denied.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=404)

    django_cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": False},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert django_cache.get(f"docs:no-websocket:{document.id}") == "other_session_key"
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_content_update_force_websocket_param_to_true(settings):
    """
    When the websocket parameter is set to true, the content should be updated without any check.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    assert django_cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": True},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert get_s3_content(document) == get_sample_ydoc()
    assert django_cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 0


@responses.activate
def test_api_documents_content_update_feature_flag_disabled(settings):
    """
    When the feature flag is disabled, the content should be updated without any check.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = False
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    assert django_cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {"content": get_sample_ydoc(), "websocket": False},
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert get_s3_content(document) == get_sample_ydoc()
    assert django_cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 0


def test_api_documents_content_upadte_invalid_yjs_doc():
    """sending an invalid yjs doc as content should return a 400."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="editor")

    client = APIClient()
    client.force_login(user)

    assert get_s3_content(document) == factories.YDOC_HELLO_WORLD_BASE64

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/content/",
        {
            "content": base64.b64encode(b"invalid yjs").decode("utf-8"),
            "websocket": True,
        },
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
