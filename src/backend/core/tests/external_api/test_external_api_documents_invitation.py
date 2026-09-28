"""
Tests for the Resource Server API for invitations.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tests.utils.urls import reload_urls

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_external_api_document_invitations_anonymous_public_standalone():
    """
    Anonymous users SHOULD NOT be allowed to list invitations from external
    API if resource server is not enabled.
    """
    invitation = factories.InvitationFactory()
    response = APIClient().get(
        f"/external_api/v1.0/documents/{invitation.document.id!s}/invitations/"
    )

    assert response.status_code == 404


def test_external_api_document_invitations_list_connected_not_resource_server():
    """
    Connected users SHOULD NOT be allowed to list document invitations
    if resource server is not enabled.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    invitation = factories.InvitationFactory()
    response = APIClient().get(
        f"/external_api/v1.0/documents/{invitation.document.id!s}/invitations/"
    )

    assert response.status_code == 404


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": [],
        },
    },
)
def test_external_api_document_invitations_list_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to list document invitations
    by default.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    invitation = factories.InvitationFactory()
    response = client.get(
        f"/external_api/v1.0/documents/{invitation.document.id!s}/invitations/"
    )

    assert response.status_code == 403


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": [],
        },
    },
)
def test_external_api_document_invitations_retrieve_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to retrieve a document invitation
    by default.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    invitation = factories.InvitationFactory()
    document = invitation.document

    response = client.get(
        f"/external_api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/"
    )

    assert response.status_code == 403


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": [],
        },
    },
)
def test_external_api_document_invitations_create_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to create a document invitation
    by default.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/invitations/",
        {"email": "invited@example.com", "role": models.RoleChoices.READER},
        format="json",
    )

    assert response.status_code == 403


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": ["list", "retrieve"],
        },
    },
)
def test_external_api_document_invitations_partial_update_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to partially update a document invitation
    by default.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )
    invitation = factories.InvitationFactory(
        document=document, role=models.RoleChoices.READER
    )

    response = client.patch(
        f"/external_api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/",
        {"role": models.RoleChoices.EDITOR},
        format="json",
    )

    assert response.status_code == 403


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": ["list", "retrieve"],
        },
    },
)
def test_external_api_document_invitations_delete_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to delete a document invitation
    by default.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )
    invitation = factories.InvitationFactory(document=document)

    response = client.delete(
        f"/external_api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/",
    )

    assert response.status_code == 403


# Overrides


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": ["list", "retrieve"],
        },
    },
)
def test_external_api_document_invitations_list_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to list document invitations
    when the action is explicitly enabled.

    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )
    invitation = factories.InvitationFactory(document=document)
    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/invitations/")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(invitation.id)


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": ["list", "retrieve"],
        },
    },
)
def test_external_api_document_invitations_retrieve_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to retrieve a document invitation
    when the action is explicitly enabled.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )
    invitation = factories.InvitationFactory(document=document)

    response = client.get(
        f"/external_api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(invitation.id)


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": ["list", "retrieve", "create"],
        },
    },
)
def test_external_api_document_invitations_create_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to create a document invitation
    when the create action is explicitly enabled.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/invitations/",
        {"email": "invited@example.com", "role": models.RoleChoices.READER},
        format="json",
    )

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "invited@example.com"
    assert data["role"] == models.RoleChoices.READER
    assert str(data["document"]) == str(document.id)


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": ["list", "retrieve", "partial_update"],
        },
    },
)
def test_external_api_document_invitations_partial_update_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to partially update a document invitation
    when the partial_update action is explicitly enabled.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )
    invitation = factories.InvitationFactory(
        document=document, role=models.RoleChoices.READER
    )

    response = client.patch(
        f"/external_api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/",
        {"role": models.RoleChoices.EDITOR},
        format="json",
    )

    assert response.status_code == 200
    data = response.json()
    assert data["role"] == models.RoleChoices.EDITOR
    assert data["email"] == invitation.email


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_invitation": {
            "enabled": True,
            "actions": ["list", "retrieve", "destroy"],
        },
    },
)
def test_external_api_document_invitations_delete_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to delete a document invitation
    when the destroy action is explicitly enabled.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )
    invitation = factories.InvitationFactory(document=document)

    response = client.delete(
        f"/external_api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/",
    )

    assert response.status_code == 204
