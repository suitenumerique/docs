"""
Test user_token API endpoints in the impress core app.
"""

import pytest
from knox.models import get_token_model
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db
AuthToken = get_token_model()

def test_api_user_token_list_anonymous(client):
    """Anonymous users should not be allowed to list user tokens."""
    response = client.get("/api/v1.0/user-tokens/")
    assert response.status_code == 403
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_user_token_list_authenticated(client):
    """
    Authenticated users should be able to list their own tokens.
    Tokens are identified by digest, and include created/expiry.
    """
    user = factories.UserFactory()
    # Knox creates a token instance and a character string token key.
    # The create method returns a tuple: (instance, token_key_string)
    token_instance_1, _ = AuthToken.objects.create(user=user)
    AuthToken.objects.create(user=user)  # Another token for the same user
    AuthToken.objects.create(user=factories.UserFactory())  # Token for a different user

    client.force_login(user)

    response = client.get("/api/v1.0/user-tokens/")
    assert response.status_code == 200
    content = response.json()
    assert len(content) == 2
    
    # Check that the response contains the digests of the tokens created for the user
    response_token_digests = {item["digest"] for item in content}
    assert token_instance_1.digest in response_token_digests
    
    # Ensure the token_key is not listed
    for item in content:
        assert "token_key" not in item
        assert "digest" in item
        assert "created" in item
        assert "expiry" in item


def test_api_user_token_create_anonymous(client):
    """Anonymous users should not be allowed to create user tokens."""
    # The create endpoint does not take any parameters as per TokenCreateSerializer
    # (user is implicit, other fields are read_only)
    response = client.post("/api/v1.0/user-tokens/", data={}) 
    assert response.status_code == 403
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_user_token_create_authenticated(client):
    """
    Authenticated users should be able to create a new token.
    The token key should be returned in the response upon creation.
    """
    user = factories.UserFactory()

    client.force_login(user)

    # The create endpoint does not take any parameters as per TokenCreateSerializer
    response = client.post("/api/v1.0/user-tokens/", data={})
    assert response.status_code == 201
    content = response.json()
    
    # Based on TokenCreateSerializer, these fields should be in the response
    assert "token_key" in content 
    assert "digest" in content
    assert "created" in content
    assert "expiry" in content
    assert len(content["token_key"]) > 0 # Knox token key should be non-empty

    # Verify the token was actually created in the database for the user
    assert AuthToken.objects.filter(user=user, digest=content["digest"]).exists() 

def test_api_user_token_destroy_anonymous(client):
    """Anonymous users should not be allowed to delete user tokens."""
    user = factories.UserFactory()
    token_instance, _ = AuthToken.objects.create(user=user)
    response = client.delete(f"/api/v1.0/user-tokens/{token_instance.digest}/")
    assert response.status_code == 403
    assert AuthToken.objects.filter(digest=token_instance.digest).exists()


def test_api_user_token_destroy_authenticated_own_token(client):
    """Authenticated users should be able to delete their own tokens."""
    user = factories.UserFactory()
    token_instance, _ = AuthToken.objects.create(user=user)

    client.force_login(user)

    response = client.delete(f"/api/v1.0/user-tokens/{token_instance.digest}/")
    assert response.status_code == 204
    assert not AuthToken.objects.filter(digest=token_instance.digest).exists()


def test_api_user_token_destroy_authenticated_other_user_token(client):
    """Authenticated users should not be able to delete other users' tokens."""
    user = factories.UserFactory()
    other_user = factories.UserFactory()
    other_user_token_instance, _ = AuthToken.objects.create(user=other_user)

    client.force_login(user) # Log in as 'user'

    response = client.delete(f"/api/v1.0/user-tokens/{other_user_token_instance.digest}/")
    # The default behavior for a non-found or non-permissioned item in DestroyModelMixin
    # when the queryset is filtered (as in get_queryset) is often a 404.
    assert response.status_code == 404 
    assert AuthToken.objects.filter(digest=other_user_token_instance.digest).exists()


def test_api_user_token_destroy_non_existent_token(client):
    """Attempting to delete a non-existent token should result in a 404."""
    user = factories.UserFactory()
    client.force_login(user)

    response = client.delete("/api/v1.0/user-tokens/nonexistentdigest/")
    assert response.status_code == 404 