"""
Tests for Documents API endpoint in impress's core app: update
"""
# pylint: disable=too-many-lines

import random

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache

import pytest
import responses
from rest_framework.test import APIClient

from core import factories, models
from core.api import serializers
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db

# A valid Yjs document derived from YDOC_HELLO_WORLD_BASE64 with "Hello" replaced by "World",
# used in PATCH tests to guarantee a real content change distinct from what DocumentFactory
# produces.
YDOC_UPDATED_CONTENT_BASE64 = (
    "AR717vLVDgAHAQ5kb2N1bWVudC1zdG9yZQMKYmxvY2tHcm91cAcA9e7y1Q4AAw5ibG9ja0NvbnRh"
    "aW5lcgcA9e7y1Q4BAwdoZWFkaW5nBwD17vLVDgIGBgD17vLVDgMGaXRhbGljAnt9hPXu8tUOBAVX"
    "b3JsZIb17vLVDgkGaXRhbGljBG51bGwoAPXu8tUOAg10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y"
    "1Q4CBWxldmVsAX0BKAD17vLVDgECaWQBdyQwNGQ2MjM0MS04MzI2LTQyMzYtYTA4My00ODdlMjZm"
    "YWQyMzAoAPXu8tUOAQl0ZXh0Q29sb3IBdwdkZWZhdWx0KAD17vLVDgEPYmFja2dyb3VuZENvbG9y"
    "AXcHZGVmYXVsdIf17vLVDgEDDmJsb2NrQ29udGFpbmVyBwD17vLVDhADDmJ1bGxldExpc3RJdGVt"
    "BwD17vLVDhEGBAD17vLVDhIBd4b17vLVDhMEYm9sZAJ7fYT17vLVDhQCb3KG9e7y1Q4WBGJvbGQE"
    "bnVsbIT17vLVDhcCbGQoAPXu8tUOEQ10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y1Q4QAmlkAXck"
    "ZDM1MWUwNjgtM2U1NS00MjI2LThlYTUtYWJiMjYzMTk4ZTJhKAD17vLVDhAJdGV4dENvbG9yAXcH"
    "ZGVmYXVsdCgA9e7y1Q4QD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHSH9e7y1Q4QAw5ibG9ja0Nv"
    "bnRhaW5lcgcA9e7y1Q4eAwlwYXJhZ3JhcGgoAPXu8tUOHw10ZXh0QWxpZ25tZW50AXcEbGVmdCgA"
    "9e7y1Q4eAmlkAXckODk3MDBjMDctZTBlMS00ZmUwLWFjYTItODQ5MzIwOWE3ZTQyKAD17vLVDh4J"
    "dGV4dENvbG9yAXcHZGVmYXVsdCgA9e7y1Q4eD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHQA"
)


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach, role",
    [
        ("restricted", "reader"),
        ("restricted", "editor"),
        ("authenticated", "reader"),
        ("authenticated", "editor"),
        ("public", "reader"),
    ],
)
def test_api_documents_update_anonymous_forbidden(reach, role, via_parent):
    """
    Anonymous users should not be allowed to update a document when link
    configuration does not allow it.
    """
    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = True
    response = APIClient().put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }

    document.refresh_from_db()
    document_values = serializers.DocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach,role",
    [
        ("public", "reader"),
        ("authenticated", "reader"),
        ("restricted", "reader"),
        ("restricted", "editor"),
    ],
)
def test_api_documents_update_authenticated_unrelated_forbidden(
    reach, role, via_parent
):
    """
    Authenticated users should not be allowed to update a document to which
    they are not related if the link configuration does not allow it.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory(),
    ).data
    new_document_values["websocket"] = True
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    document_values = serializers.DocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "is_authenticated,reach,role",
    [
        (False, "public", "editor"),
        (True, "public", "editor"),
        (True, "authenticated", "editor"),
    ],
)
def test_api_documents_update_anonymous_or_authenticated_unrelated(
    is_authenticated, reach, role, via_parent
):
    """
    Anonymous and authenticated users should be able to update a document to which
    they are not related if the link configuration allows it.
    """
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory(with_owned_document=True)
        client.force_login(user)
    else:
        user = AnonymousUser()

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory(),
    ).data
    new_document_values["websocket"] = True
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document = models.Document.objects.get(pk=document.pk)
    document_values = serializers.DocumentSerializer(instance=document).data
    for key, value in document_values.items():
        if key in [
            "id",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "accesses",
            "created_at",
            "creator",
            "depth",
            "link_reach",
            "link_role",
            "numchild",
            "path",
        ]:
            assert value == old_document_values[key]
        elif key == "updated_at":
            assert value > old_document_values[key]
        else:
            assert value == new_document_values[key]


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_update_authenticated_reader(via, via_parent, mock_user_teams):
    """
    Users who are reader of a document should not be allowed to update it.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role="reader"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role="reader"
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = True
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    document_values = serializers.DocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_update_authenticated_editor_administrator_or_owner(
    via, role, via_parent, mock_user_teams
):
    """A user who is editor, administrator or owner of a document should be allowed to update it."""
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role=role
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = True
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document = models.Document.objects.get(pk=document.pk)
    document_values = serializers.DocumentSerializer(instance=document).data
    for key, value in document_values.items():
        if key in [
            "id",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "created_at",
            "creator",
            "depth",
            "link_reach",
            "link_role",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
        ]:
            assert value == old_document_values[key]
        elif key == "updated_at":
            assert value > old_document_values[key]
        else:
            assert value == new_document_values[key]


@responses.activate
def test_api_documents_update_authenticated_no_websocket(settings):
    """
    When a user updates the document, not connected to the websocket and is the first to update,
    the document should be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = False
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )

    ws_resp = responses.get(endpoint_url, json={"count": 0, "exists": False})

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document.refresh_from_db()
    assert document.path == old_path
    assert cache.get(f"docs:no-websocket:{document.id}") == session_key
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_update_authenticated_no_websocket_user_already_editing(settings):
    """
    When a user updates the document, not connected to the websocket and is not the first to update,
    the document should not be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = False
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 0, "exists": False})

    cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "You are not allowed to edit this document."}

    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_update_no_websocket_other_user_connected_to_websocket(settings):
    """
    When a user updates the document, not connected to the websocket and another user is connected
    to the websocket, the document should not be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = False
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 3, "exists": False})

    assert cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "You are not allowed to edit this document."}
    assert cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_update_user_connected_to_websocket(settings):
    """
    When a user updates the document, connected to the websocket, the document should be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = False
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 3, "exists": True})

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document.refresh_from_db()
    assert document.path == old_path
    assert cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_update_websocket_server_unreachable_fallback_to_no_websocket(
    settings,
):
    """
    When the websocket server is unreachable, the document should be updated like if the user was
    not connected to the websocket.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = False
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document.refresh_from_db()
    assert document.path == old_path
    assert cache.get(f"docs:no-websocket:{document.id}") == session_key
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_update_websocket_server_unreachable_fallback_to_no_websocket_other_users(
    settings,
):
    """
    When the websocket server is unreachable, the behavior fallback to the no websocket one.
    If an other user is already editing, the document should not be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = False
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 403

    assert cache.get(f"docs:no-websocket:{document.id}") == "other_session_key"
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_update_websocket_server_room_not_found_fallback_to_no_websocket_other_users(
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

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = False
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=404)

    cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 403

    assert cache.get(f"docs:no-websocket:{document.id}") == "other_session_key"
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_update_force_websocket_param_to_true(settings):
    """
    When the websocket parameter is set to true, the document should be updated without any check.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = True
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document.refresh_from_db()
    assert document.path == old_path
    assert cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 0


@responses.activate
def test_api_documents_update_feature_flag_disabled(settings):
    """
    When the feature flag is disabled, the document should be updated without any check.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = False
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = False
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document.refresh_from_db()
    assert document.path == old_path
    assert cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 0


@pytest.mark.parametrize("via", VIA)
def test_api_documents_update_administrator_or_owner_of_another(via, mock_user_teams):
    """
    Being administrator or owner of a document should not grant authorization to update
    another document.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role=random.choice(["administrator", "owner"])
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document,
            team="lasuite",
            role=random.choice(["administrator", "owner"]),
        )

    other_document = factories.DocumentFactory(title="Old title", link_role="reader")
    old_document_values = serializers.DocumentSerializer(instance=other_document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    new_document_values["websocket"] = True
    response = client.put(
        f"/api/v1.0/documents/{other_document.id!s}/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403

    other_document.refresh_from_db()
    other_document_values = serializers.DocumentSerializer(instance=other_document).data
    assert other_document_values == old_document_values


def test_api_documents_update_invalid_content():
    """
    Updating a document with a non base64 encoded content should raise a validation error.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[[user, "owner"]])

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": "invalid content"},
        format="json",
    )
    assert response.status_code == 400
    assert response.json() == {"content": ["Invalid base64 content."]}


# =============================================================================
# PATCH tests
# =============================================================================


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach, role",
    [
        ("restricted", "reader"),
        ("restricted", "editor"),
        ("authenticated", "reader"),
        ("authenticated", "editor"),
        ("public", "reader"),
    ],
)
def test_api_documents_patch_anonymous_forbidden(reach, role, via_parent):
    """
    Anonymous users should not be allowed to patch a document when link
    configuration does not allow it.
    """
    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    new_content = YDOC_UPDATED_CONTENT_BASE64

    response = APIClient().patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }

    document.refresh_from_db()
    assert serializers.DocumentSerializer(instance=document).data == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach,role",
    [
        ("public", "reader"),
        ("authenticated", "reader"),
        ("restricted", "reader"),
        ("restricted", "editor"),
    ],
)
def test_api_documents_patch_authenticated_unrelated_forbidden(reach, role, via_parent):
    """
    Authenticated users should not be allowed to patch a document to which
    they are not related if the link configuration does not allow it.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    new_content = YDOC_UPDATED_CONTENT_BASE64

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    assert serializers.DocumentSerializer(instance=document).data == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "is_authenticated,reach,role",
    [
        (False, "public", "editor"),
        (True, "public", "editor"),
        (True, "authenticated", "editor"),
    ],
)
def test_api_documents_patch_anonymous_or_authenticated_unrelated(
    is_authenticated, reach, role, via_parent
):
    """
    Anonymous and authenticated users should be able to patch a document to which
    they are not related if the link configuration allows it.
    """
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory(with_owned_document=True)
        client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    old_path = document.path
    new_content = YDOC_UPDATED_CONTENT_BASE64

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content, "websocket": True},
        format="json",
    )
    assert response.status_code == 200

    # Using document.refresh_from_db does not wirk because the content is in cache.
    # Force reloading it by fetching the document in the database.
    document = models.Document.objects.get(id=document.id)
    assert document.path == old_path
    assert document.content == new_content
    document_values = serializers.DocumentSerializer(instance=document).data
    for key in [
        "id",
        "title",
        "link_reach",
        "link_role",
        "creator",
        "depth",
        "numchild",
        "path",
    ]:
        assert document_values[key] == old_document_values[key]


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_patch_authenticated_reader(via, via_parent, mock_user_teams):
    """Users who are reader of a document should not be allowed to patch it."""
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role="reader"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role="reader"
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data
    new_content = YDOC_UPDATED_CONTENT_BASE64

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    assert serializers.DocumentSerializer(instance=document).data == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_patch_authenticated_editor_administrator_or_owner(
    via, role, via_parent, mock_user_teams
):
    """A user who is editor, administrator or owner of a document should be allowed to patch it."""
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role=role
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data
    old_path = document.path
    new_content = YDOC_UPDATED_CONTENT_BASE64

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content, "websocket": True},
        format="json",
    )
    assert response.status_code == 200

    # Using document.refresh_from_db does not wirk because the content is in cache.
    # Force reloading it by fetching the document in the database.
    document = models.Document.objects.get(id=document.id)
    assert document.path == old_path
    assert document.content == new_content
    document_values = serializers.DocumentSerializer(instance=document).data
    for key in [
        "id",
        "title",
        "link_reach",
        "link_role",
        "creator",
        "depth",
        "numchild",
        "path",
        "nb_accesses_ancestors",
        "nb_accesses_direct",
    ]:
        assert document_values[key] == old_document_values[key]


@responses.activate
def test_api_documents_patch_authenticated_no_websocket(settings):
    """
    When a user patches the document, not connected to the websocket and is the first to update,
    the document should be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])
    new_content = YDOC_UPDATED_CONTENT_BASE64

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 0, "exists": False})

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )
    assert response.status_code == 200

    # Using document.refresh_from_db does not work because the content is cached.
    # Force reloading it by fetching the document from the database.
    document = models.Document.objects.get(id=document.id)
    assert document.path == old_path
    assert document.content == new_content
    assert cache.get(f"docs:no-websocket:{document.id}") == session_key
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_patch_authenticated_no_websocket_user_already_editing(settings):
    """
    When a user patches the document, not connected to the websocket and is not the first to
    update, the document should not be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])
    new_content = YDOC_UPDATED_CONTENT_BASE64

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 0, "exists": False})

    cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "You are not allowed to edit this document."}

    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_patch_no_websocket_other_user_connected_to_websocket(settings):
    """
    When a user patches the document, not connected to the websocket and another user is connected
    to the websocket, the document should not be updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])
    new_content = YDOC_UPDATED_CONTENT_BASE64

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 3, "exists": False})

    assert cache.get(f"docs:no-websocket:{document.id}") is None

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "You are not allowed to edit this document."}
    assert cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_patch_user_connected_to_websocket(settings):
    """
    When a user patches the document while connected to the websocket, the document should be
    updated.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])
    new_content = YDOC_UPDATED_CONTENT_BASE64

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, json={"count": 3, "exists": True})

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )
    assert response.status_code == 200

    # Using document.refresh_from_db does not wirk because the content is in cache.
    # Force reloading it by fetching the document in the database.
    document = models.Document.objects.get(id=document.id)
    assert document.path == old_path
    assert document.content == new_content
    assert cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_patch_websocket_server_unreachable_fallback_to_no_websocket(
    settings,
):
    """
    When the websocket server is unreachable, the patch should be applied like if the user was
    not connected to the websocket.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])
    new_content = YDOC_UPDATED_CONTENT_BASE64

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )
    assert response.status_code == 200

    # Using document.refresh_from_db does not work because the content is cached.
    # Force reloading it by fetching the document from the database.
    document = models.Document.objects.get(id=document.id)
    assert document.path == old_path
    assert document.content == new_content
    assert cache.get(f"docs:no-websocket:{document.id}") == session_key
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_patch_websocket_server_unreachable_fallback_to_no_websocket_other_users(
    settings,
):
    """
    When the websocket server is unreachable, the behavior falls back to no-websocket.
    If another user is already editing, the patch must be denied.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])
    new_content = YDOC_UPDATED_CONTENT_BASE64

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )
    assert response.status_code == 403

    assert cache.get(f"docs:no-websocket:{document.id}") == "other_session_key"
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_patch_websocket_server_room_not_found_fallback_to_no_websocket_other_users(
    settings,
):
    """
    When the WebSocket server does not have the room created, the logic should fallback to
    no-WebSocket. If another user is already editing, the patch must be denied.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])
    new_content = YDOC_UPDATED_CONTENT_BASE64

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = True
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=404)

    cache.set(f"docs:no-websocket:{document.id}", "other_session_key")

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )
    assert response.status_code == 403

    assert cache.get(f"docs:no-websocket:{document.id}") == "other_session_key"
    assert ws_resp.call_count == 1


@responses.activate
def test_api_documents_patch_force_websocket_param_to_true(settings):
    """
    When the websocket parameter is set to true, the patch should be applied without any check.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])
    new_content = YDOC_UPDATED_CONTENT_BASE64

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content, "websocket": True},
        format="json",
    )
    assert response.status_code == 200

    # Using document.refresh_from_db does not work because the content is cached.
    # Force reloading it by fetching the document from the database.
    document = models.Document.objects.get(id=document.id)
    assert document.path == old_path
    assert document.content == new_content
    assert cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 0


@responses.activate
def test_api_documents_patch_feature_flag_disabled(settings):
    """
    When the feature flag is disabled, the patch should be applied without any check.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)
    session_key = client.session.session_key

    document = factories.DocumentFactory(users=[(user, "editor")])
    new_content = YDOC_UPDATED_CONTENT_BASE64

    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    settings.COLLABORATION_WS_NOT_CONNECTED_READY_ONLY = False
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}get-connections/"
        f"?room={document.id}&sessionKey={session_key}"
    )
    ws_resp = responses.get(endpoint_url, status=500)

    assert cache.get(f"docs:no-websocket:{document.id}") is None
    old_path = document.path

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": new_content},
        format="json",
    )
    assert response.status_code == 200

    # Using document.refresh_from_db does not work because the content is cached.
    # Force reloading it by fetching the document from the database.
    document = models.Document.objects.get(id=document.id)
    assert document.path == old_path
    assert document.content == new_content
    assert cache.get(f"docs:no-websocket:{document.id}") is None
    assert ws_resp.call_count == 0


@pytest.mark.parametrize("via", VIA)
def test_api_documents_patch_administrator_or_owner_of_another(via, mock_user_teams):
    """
    Being administrator or owner of a document should not grant authorization to patch
    another document.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role=random.choice(["administrator", "owner"])
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document,
            team="lasuite",
            role=random.choice(["administrator", "owner"]),
        )

    other_document = factories.DocumentFactory(title="Old title", link_role="reader")
    old_document_values = serializers.DocumentSerializer(instance=other_document).data
    new_content = YDOC_UPDATED_CONTENT_BASE64

    response = client.patch(
        f"/api/v1.0/documents/{other_document.id!s}/",
        {"content": new_content},
        format="json",
    )

    assert response.status_code == 403

    other_document.refresh_from_db()
    assert (
        serializers.DocumentSerializer(instance=other_document).data
        == old_document_values
    )


def test_api_documents_patch_invalid_content():
    """
    Patching a document with a non base64 encoded content should raise a validation error.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[[user, "owner"]])

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": "invalid content"},
        format="json",
    )
    assert response.status_code == 400
    assert response.json() == {"content": ["Invalid base64 content."]}
