"""
Tests for Documents API endpoint in impress's core app: update
"""

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

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

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

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200
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

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

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

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

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

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

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
