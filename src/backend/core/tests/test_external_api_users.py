"""
Tests for the Resource Server API for users.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

import pytest
from rest_framework.test import APIClient

from core import factories
from core.api import serializers
from core.tests.utils.urls import reload_urls

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_external_api_users_me_anonymous_public_standalone():
    """
    Anonymous users SHOULD NOT be allowed to retrieve their own user information from external
    API if resource server is not enabled.
    """
    reload_urls()
    response = APIClient().get("/external_api/v1.0/users/me/")

    assert response.status_code == 404


def test_external_api_users_me_connected_not_allowed():
    """
    Connected users SHOULD NOT be allowed to retrieve their own user information from external
    API if resource server is not enabled.
    """
    reload_urls()
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.get("/external_api/v1.0/users/me/")

    assert response.status_code == 404


def test_external_api_users_me_connected(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to retrieve their own user information from external API
    if resource server is enabled.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    response = client.get("/external_api/v1.0/users/me/")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user_specific_sub.id)
    assert data["email"] == user_specific_sub.email


def test_external_api_users_me_connected_with_invalid_token_not_allowed(
    user_token, resource_server_backend
):
    """
    Connected users SHOULD NOT be allowed to retrieve their own user information from external API
    if resource server is enabled with an invalid token.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    response = client.get("/external_api/v1.0/users/me/")

    assert response.status_code == 401


# Non allowed actions on resource server.


def test_external_api_users_list_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to list users from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    response = client.get("/external_api/v1.0/users/")

    assert response.status_code == 403


def test_external_api_users_retrieve_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to retrieve a specific user from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    other_user = factories.UserFactory()

    response = client.get(f"/external_api/v1.0/users/{other_user.id!s}/")

    assert response.status_code == 403


def test_external_api_users_put_patch_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to update or patch a user from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    other_user = factories.UserFactory()

    new_user_values = {
        k: v
        for k, v in serializers.UserSerializer(
            instance=factories.UserFactory()
        ).data.items()
        if v is not None
    }
    response = client.put(
        f"/external_api/v1.0/users/{other_user.id!s}/", new_user_values
    )

    assert response.status_code == 403

    response = client.patch(
        f"/external_api/v1.0/users/{other_user.id!s}/",
        {"email": "new_email@example.com"},
    )

    assert response.status_code == 403


def test_external_api_users_delete_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to delete a user from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    other_user = factories.UserFactory()

    response = client.delete(f"/external_api/v1.0/users/{other_user.id!s}/")

    assert response.status_code == 403
