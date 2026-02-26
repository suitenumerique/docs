"""
Tests for the Resource Server API for document favorites.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_external_api_documents_favorites_list_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to list their favorites
    from a resource server, as favorite_list() bypasses permissions.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.UserDocumentAccessFactory(
        user=user_specific_sub,
        role=models.RoleChoices.READER,
        document__favorited_by=[user_specific_sub],
    ).document

    response = client.get("/external_api/v1.0/documents/favorite_list/")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(document.id)


def test_external_api_documents_favorite_add_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    By default the "favorite" action is not permitted on the external API.
    POST to the endpoint must return 403.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)

    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    response = client.post(f"/external_api/v1.0/documents/{document.id!s}/favorite/")
    assert response.status_code == 403


def test_external_api_documents_favorite_delete_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    By default the "favorite" action is not permitted on the external API.
    DELETE to the endpoint must return 403.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    response = client.delete(f"/external_api/v1.0/documents/{document.id!s}/favorite/")
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
                "favorite",
            ],
        },
    }
)
def test_external_api_documents_favorite_add_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Users SHOULD be allowed to POST to the favorite endpoint when the
    corresponding action is enabled via EXTERNAL_API settings.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    response = client.post(f"/external_api/v1.0/documents/{document.id!s}/favorite/")
    assert response.status_code == 201
    assert models.DocumentFavorite.objects.filter(
        document=document, user=user_specific_sub
    ).exists()


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
                "favorite",
            ],
        },
    }
)
def test_external_api_documents_favorite_delete_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Users SHOULD be allowed to DELETE from the favorite endpoint when the
    corresponding action is enabled via EXTERNAL_API settings.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED, favorited_by=[user_specific_sub]
    )
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    response = client.delete(f"/external_api/v1.0/documents/{document.id!s}/favorite/")
    assert response.status_code == 204
    assert not models.DocumentFavorite.objects.filter(
        document=document, user=user_specific_sub
    ).exists()
