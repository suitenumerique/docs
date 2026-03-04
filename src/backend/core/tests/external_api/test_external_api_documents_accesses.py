"""
Tests for the Resource Server API for documents accesses.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

from django.test import override_settings

import pytest
import responses
from rest_framework.test import APIClient

from core import factories, models
from core.api import serializers
from core.tests.utils.urls import reload_urls

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_external_api_document_accesses_anonymous_public_standalone():
    """
    Anonymous users SHOULD NOT be allowed to list document accesses
    from external API if resource server is not enabled.
    """
    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
    )

    response = APIClient().get(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/"
    )

    assert response.status_code == 404


def test_external_api_document_accesses_list_connected_not_resource_server():
    """
    Connected users SHOULD NOT be allowed to list document accesses
    if resource server is not enabled.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)

    response = APIClient().get(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/"
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
        "document_access": {
            "enabled": True,
            "actions": [],
        },
    }
)
def test_external_api_document_accesses_list_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to list the accesses of
    a document from a resource server.
    """
    reload_urls()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/accesses/")

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
        "document_access": {
            "enabled": True,
            "actions": [],
        },
    }
)
def test_external_api_document_accesses_retrieve_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to retrieve a specific access of
    a document from a resource server.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    access = factories.UserDocumentAccessFactory(document=document)

    response = client.get(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/"
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
        "document_access": {
            "enabled": True,
            "actions": [],
        },
    }
)
def test_external_api_documents_accesses_create_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to create an access for a document
    from a resource server.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    other_user = factories.UserFactory()

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/",
        {"user_id": other_user.id, "role": models.RoleChoices.READER},
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
        "document_access": {
            "enabled": True,
            "actions": [],
        },
    }
)
def test_external_api_document_accesses_update_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to update an access for a
    document from a resource server through PUT.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    other_user = factories.UserFactory()
    access = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role=models.RoleChoices.READER
    )

    response = client.put(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        {"role": models.RoleChoices.EDITOR},
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
        "document_access": {
            "enabled": True,
            "actions": [],
        },
    }
)
def test_external_api_document_accesses_partial_update_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to update an access
    for a document from a resource server through PATCH.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    other_user = factories.UserFactory()
    access = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role=models.RoleChoices.READER
    )

    response = client.patch(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        {"role": models.RoleChoices.EDITOR},
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
        "document_access": {
            "enabled": True,
            "actions": [],
        },
    }
)
def test_external_api_documents_accesses_delete_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to delete an access for
    a document from a resource server.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    access = factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.delete(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
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
        "document_access": {
            "enabled": True,
            "actions": ["list", "retrieve"],
        },
    }
)
def test_external_api_document_accesses_list_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to list the accesses of a document from a resource server
    when the list action is enabled in EXTERNAL_API document_access settings.
    """

    reload_urls()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED, creator=user_specific_sub
    )
    user_access = factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )
    # Create additional accesses
    other_user = factories.UserFactory()
    other_access = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role=models.RoleChoices.READER
    )

    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/accesses/")

    assert response.status_code == 200
    data = response.json()

    access_ids = [entry["id"] for entry in data]
    assert str(user_access.id) in access_ids
    assert str(other_access.id) in access_ids


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
        "document_access": {
            "enabled": True,
            "actions": ["list", "retrieve"],
        },
    }
)
def test_external_api_document_accesses_retrieve_can_be_allowed(
    user_token,
    resource_server_backend,
    user_specific_sub,
):
    """
    A user who is related to a document SHOULD be allowed to retrieve the
    associated document user accesses.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    access = factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    response = client.get(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
    )
    data = response.json()

    assert response.status_code == 200
    assert data["id"] == str(access.id)


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
        "document_access": {
            "enabled": True,
            "actions": ["list", "create"],
        },
    }
)
def test_external_api_document_accesses_create_can_be_allowed(
    user_token,
    resource_server_backend,
    user_specific_sub,
):
    """
    A user who is related to a document SHOULD be allowed to create
    a user access for the document.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    other_user = factories.UserFactory()

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/",
        data={"user_id": other_user.id, "role": models.RoleChoices.READER},
    )
    data = response.json()

    assert response.status_code == 201
    assert data["role"] == models.RoleChoices.READER
    assert str(data["user"]["id"]) == str(other_user.id)


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
        "document_access": {
            "enabled": True,
            "actions": ["list", "update"],
        },
    }
)
def test_external_api_document_accesses_update_can_be_allowed(
    user_token,
    resource_server_backend,
    user_specific_sub,
    settings,
):
    """
    A user who is related to a document SHOULD be allowed to update
    a user access for the document through PUT.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    other_user = factories.UserFactory()
    access = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role=models.RoleChoices.READER
    )

    # Add the reset-connections endpoint to the existing mock
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}reset-connections/?room={document.id}"
    )
    resource_server_backend.add(
        responses.POST,
        endpoint_url,
        json={},
        status=200,
    )

    old_values = serializers.DocumentAccessSerializer(instance=access).data

    # Update only the role field
    response = client.put(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        {**old_values, "role": models.RoleChoices.EDITOR},  #  type: ignore
        format="json",
    )

    assert response.status_code == 200
    data = response.json()
    assert data["role"] == models.RoleChoices.EDITOR
    assert str(data["user"]["id"]) == str(other_user.id)


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
        "document_access": {
            "enabled": True,
            "actions": ["list", "partial_update"],
        },
    }
)
def test_external_api_document_accesses_partial_update_can_be_allowed(
    user_token,
    resource_server_backend,
    user_specific_sub,
    settings,
):
    """
    A user who is related to a document SHOULD be allowed to update
    a user access for the document through PATCH.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    other_user = factories.UserFactory()
    access = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role=models.RoleChoices.READER
    )

    # Add the reset-connections endpoint to the existing mock
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}reset-connections/?room={document.id}"
    )
    resource_server_backend.add(
        responses.POST,
        endpoint_url,
        json={},
        status=200,
    )

    response = client.patch(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/{access.id!s}/",
        data={"role": models.RoleChoices.EDITOR},
    )
    data = response.json()

    assert response.status_code == 200
    assert data["role"] == models.RoleChoices.EDITOR
    assert str(data["user"]["id"]) == str(other_user.id)


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
        "document_access": {
            "enabled": True,
            "actions": ["list", "destroy"],
        },
    }
)
def test_external_api_documents_accesses_delete_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub, settings
):
    """
    Connected users SHOULD be allowed to delete an access for
    a document from a resource server when the destroy action is
    enabled in settings.
    """
    reload_urls()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )
    other_user = factories.UserFactory()
    other_access = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role=models.RoleChoices.READER
    )

    # Add the reset-connections endpoint to the existing mock
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    endpoint_url = (
        f"{settings.COLLABORATION_API_URL}reset-connections/?room={document.id}"
    )
    resource_server_backend.add(
        responses.POST,
        endpoint_url,
        json={},
        status=200,
    )

    response = client.delete(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/{other_access.id!s}/",
    )

    assert response.status_code == 204
