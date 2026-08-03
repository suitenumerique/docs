"""Test the can_edit endpoint in the viewset DocumentViewSet."""

from django.core.cache import cache

import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("ws_not_connected_ready_only", [True, False])
@pytest.mark.parametrize("role", ["editor", "reader"])
def test_api_documents_can_edit_anonymous(settings, ws_not_connected_ready_only, role):
    """Anonymous users can edit documents when link_role is editor."""
    document = factories.DocumentFactory(link_reach="public", link_role=role)
    client = APIClient()
    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = ws_not_connected_ready_only

    response = client.get(f"/api/v1.0/documents/{document.id!s}/can-edit/")

    if role == "reader":
        assert response.status_code == 401
    else:
        assert response.status_code == 200
        assert response.json() == {"can_edit": True}


@pytest.mark.parametrize("ws_not_connected_ready_only", [True, False])
def test_api_documents_can_edit_authenticated_no_websocket(
    settings, ws_not_connected_ready_only
):
    """
    A user not connected to the websocket and no other user have already updated the document,
    the document can be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = ws_not_connected_ready_only

    assert cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/can-edit/",
    )
    assert response.status_code == 200

    assert response.json() == {"can_edit": True}


def test_api_documents_can_edit_authenticated_no_websocket_user_already_editing(
    settings,
):
    """
    A user not connected to the websocket and another user have already updated the document,
    the document can not be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True

    cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/can-edit/",
    )
    assert response.status_code == 200
    assert response.json() == {"can_edit": False}


# TODO(yhub): removed test_api_documents_can_edit_no_websocket_other_user_connected_to_websocket
# here. yhub has no connection-info API: get_document_connection_info is stubbed to report
# nobody connected, so another user connected to the websocket can no longer block edition.
# Re-add the test once yhub exposes a connection-info API.


def test_api_documents_can_edit_user_connected_to_websocket(settings):
    """
    A user connected to the websocket, the document can be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True

    assert cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/can-edit/",
    )
    assert response.status_code == 200
    assert response.json() == {"can_edit": True}
    assert cache.get(f"docs:no-websocket:{document.id}") is None


def test_api_documents_can_edit_websocket_server_unreachable_fallback_to_no_websocket(
    settings,
):
    """
    When the websocket server is unreachable, the document can be updated like if the user was
    not connected to the websocket.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True

    assert cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/can-edit/",
    )
    assert response.status_code == 200
    assert response.json() == {"can_edit": True}


def test_api_documents_can_edit_websocket_server_unreachable_fallback_to_no_websocket_other_users(
    settings,
):
    """
    When the websocket server is unreachable, the behavior fallback to the no websocket one.
    If an other user is already editing, the document can not be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True

    cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/can-edit/",
    )
    assert response.status_code == 200
    assert response.json() == {"can_edit": False}

    assert cache.get(f"docs:no-websocket:{document.id}") == "other_session_key"


def test_api_documents_can_edit_websocket_server_room_not_found(
    settings,
):
    """
    When the websocket server returns a 404, the document can be updated like if the user was
    not connected to the websocket.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True

    assert cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/can-edit/",
    )
    assert response.status_code == 200
    assert response.json() == {"can_edit": True}


def test_api_documents_can_edit_websocket_server_room_not_found_other_already_editing(
    settings,
):
    """
    When the websocket server returns a 404 and another user is editing the document,
    the response should be can-edit=False.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "editor")])

    settings.COLLABORATION_WS_NOT_CONNECTED_READ_ONLY = True

    cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/can-edit/",
    )
    assert response.status_code == 200
    assert response.json() == {"can_edit": False}
