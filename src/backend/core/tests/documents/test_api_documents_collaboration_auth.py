"""
Test collaboration websocket access API endpoint for users in impress's core app.
"""

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


def test_api_documents_collaboration_auth_original_url_not_matching():
    """
    Trying to authenticate on the collaboration server with an invalid
    original url should return a 403.
    """
    document = factories.DocumentFactory(link_reach="public")

    response = APIClient().get(
        "/api/v1.0/documents/collaboration-auth/",
        HTTP_X_ORIGINAL_URL=f"http://localhost/ws/?invalid={document.pk}",
    )

    assert response.status_code == 403
    assert "Authorization" not in response
    assert "X-Can-Edit" not in response
    assert "X-User-Id" not in response


def test_api_documents_collaboration_auth_secret_not_defined():
    """
    Trying to authenticate on the collaboration server when the secret is not defined
    should return a 403.
    """
    document = factories.DocumentFactory(link_reach="public")

    response = APIClient().get(
        "/api/v1.0/documents/collaboration-auth/",
        HTTP_X_ORIGINAL_URL=f"http://localhost/ws/?room={document.pk}",
    )

    assert response.status_code == 403
    assert "Authorization" not in response
    assert "X-Can-Edit" not in response
    assert "X-User-Id" not in response


@override_settings(COLLABORATION_SERVER_SECRET="123")
@pytest.mark.parametrize("reach", ["authenticated", "restricted"])
def test_api_documents_collaboration_auth_anonymous_authenticated_or_restricted(reach):
    """
    Anonymous users should not be allowed to connect to the collaboration server for a document
    with link reach set to authenticated or restricted.
    """
    document = factories.DocumentFactory(link_reach=reach)

    response = APIClient().get(
        "/api/v1.0/documents/collaboration-auth/",
        HTTP_X_ORIGINAL_URL=f"http://localhost/ws/?room={document.pk}",
    )

    assert response.status_code == 403
    assert "Authorization" not in response
    assert "X-Can-Edit" not in response
    assert "X-User-Id" not in response


@override_settings(COLLABORATION_SERVER_SECRET="123")
def test_api_documents_collaboration_auth_anonymous_public():
    """
    Anonymous users should be able to connect to the collaboration server for a public document.
    """
    document = factories.DocumentFactory(link_reach="public")

    response = APIClient().get(
        "/api/v1.0/documents/collaboration-auth/",
        HTTP_X_ORIGINAL_URL=f"http://localhost/ws/?room={document.pk}",
    )

    assert response.status_code == 200
    assert response["Authorization"] == "123"
    assert response["X-Can-Edit"] == str(document.link_role == "editor")
    assert "X-User-Id" not in response


@override_settings(COLLABORATION_SERVER_SECRET="123")
@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_collaboration_auth_authenticated_public_or_authenticated(reach):
    """
    Authenticated users who are not related to a document should be able to connect to the
    collaboration server if this document's link reach is set to public or authenticated.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)

    response = client.get(
        "/api/v1.0/documents/collaboration-auth/",
        HTTP_X_ORIGINAL_URL=f"http://localhost/ws/?room={document.pk}",
    )

    assert response.status_code == 200
    assert response["Authorization"] == "123"
    assert response["X-Can-Edit"] == str(document.link_role == "editor")
    assert response["X-User-Id"] == str(user.id)


@override_settings(COLLABORATION_SERVER_SECRET="123")
def test_api_documents_collaboration_auth_authenticated_restricted():
    """
    Authenticated users who are not related to a document should not be allowed to connect to the
    collaboration server if this document's link reach is set to restricted.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")

    response = client.get(
        "/api/v1.0/documents/collaboration-auth/",
        HTTP_X_ORIGINAL_URL=f"http://localhost/ws/?room={document.pk}",
    )

    assert response.status_code == 403
    assert "Authorization" not in response
    assert "X-Can-Edit" not in response
    assert "X-User-Id" not in response


@override_settings(COLLABORATION_SERVER_SECRET="123")
@pytest.mark.parametrize("role", models.RoleChoices.values)
@pytest.mark.parametrize("via", VIA)
def test_api_documents_collaboration_auth_related(via, role, mock_user_teams):
    """
    Users who have a specific access to a document, whatever the role, should be able to
    connect to the collaboration server for this document.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    response = client.get(
        "/api/v1.0/documents/collaboration-auth/",
        HTTP_X_ORIGINAL_URL=f"http://localhost/ws/?room={document.pk}",
    )

    assert response.status_code == 200
    assert response["Authorization"] == "123"
    assert response["X-Can-Edit"] == str(role != "reader")
    assert response["X-User-Id"] == str(user.id)
