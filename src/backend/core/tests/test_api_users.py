"""
Test users API endpoints in the impress core app.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import serializers

pytestmark = pytest.mark.django_db


def test_api_users_list_anonymous():
    """Anonymous users should not be allowed to list users."""
    factories.UserFactory()
    client = APIClient()
    response = client.get("/api/v1.0/users/")
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_users_list_authenticated():
    """
    Authenticated users should not be able to list users without a query.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    factories.UserFactory.create_batch(2)
    response = client.get(
        "/api/v1.0/users/",
    )
    assert response.status_code == 200
    content = response.json()
    assert content == []


def test_api_users_list_query_email():
    """
    Authenticated users should be able to list users and filter by email.
    Only results with a Levenstein distance less than 3 with the query should be returned.
    We want to match by Levenstein distance because we want to prevent typing errors.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    dave = factories.UserFactory(email="david.bowman@work.com")
    factories.UserFactory(email="nicole.bowman@work.com")

    response = client.get(
        "/api/v1.0/users/?q=david.bowman@work.com",
    )
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(dave.id)]

    response = client.get(
        "/api/v1.0/users/?q=davig.bovman@worm.com",
    )
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(dave.id)]

    response = client.get(
        "/api/v1.0/users/?q=davig.bovman@worm.cop",
    )
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == []


def test_api_users_list_limit(settings):
    """
    Authenticated users should be able to list users and the number of results
    should be limited to 10.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    # Use a base name with a length equal 5 to test that the limit is applied
    base_name = "alice"
    for i in range(15):
        factories.UserFactory(email=f"{base_name}.{i}@example.com")

    response = client.get(
        "/api/v1.0/users/?q=alice",
    )
    assert response.status_code == 200
    assert len(response.json()) == 5

    # if the limit is changed, all users should be returned
    settings.API_USERS_LIST_LIMIT = 100
    response = client.get(
        "/api/v1.0/users/?q=alice",
    )
    assert response.status_code == 200
    assert len(response.json()) == 15


def test_api_users_list_throttling_authenticated(settings):
    """
    Authenticated users should be throttled.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["user_list_burst"] = "3/minute"

    for _i in range(3):
        response = client.get(
            "/api/v1.0/users/?q=alice",
        )
        assert response.status_code == 200

    response = client.get(
        "/api/v1.0/users/?q=alice",
    )
    assert response.status_code == 429


def test_api_users_list_query_email_matching():
    """While filtering by email, results should be filtered and sorted by Levenstein distance."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    user1 = factories.UserFactory(email="alice.johnson@example.gouv.fr")
    user2 = factories.UserFactory(email="alice.johnnson@example.gouv.fr")
    user3 = factories.UserFactory(email="alice.kohlson@example.gouv.fr")
    user4 = factories.UserFactory(email="alicia.johnnson@example.gouv.fr")
    user5 = factories.UserFactory(email="alicia.johnnson@example.gov.uk")
    factories.UserFactory(email="alice.thomson@example.gouv.fr")

    response = client.get(
        "/api/v1.0/users/?q=alice.johnson@example.gouv.fr",
    )
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(user1.id), str(user2.id), str(user3.id), str(user4.id)]

    response = client.get("/api/v1.0/users/?q=alicia.johnnson@example.gouv.fr")

    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(user4.id), str(user2.id), str(user1.id), str(user5.id)]


def test_api_users_list_query_email_exclude_doc_user():
    """
    Authenticated users should be able to list users while filtering by email
    and excluding users who have access to a document.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory()

    client = APIClient()
    client.force_login(user)

    nicole_fool = factories.UserFactory(email="nicole_fool@work.com")
    nicole_pool = factories.UserFactory(email="nicole_pool@work.com")
    factories.UserFactory(email="heywood_floyd@work.com")

    factories.UserDocumentAccessFactory(document=document, user=nicole_pool)

    response = client.get(
        "/api/v1.0/users/?q=nicole_fool@work.com&document_id=" + str(document.id)
    )

    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(nicole_fool.id)]


def test_api_users_list_query_short_queries():
    """
    Queries shorter than 5 characters should return an empty result set.
    """
    user = factories.UserFactory(email="paul@example.com")
    client = APIClient()
    client.force_login(user)

    factories.UserFactory(email="john.doe@example.com")
    factories.UserFactory(email="john.lennon@example.com")

    response = client.get("/api/v1.0/users/?q=jo")
    assert response.status_code == 200
    assert response.json() == []

    response = client.get("/api/v1.0/users/?q=john")
    assert response.status_code == 200
    assert response.json() == []

    response = client.get("/api/v1.0/users/?q=john.")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_api_users_list_query_inactive():
    """Inactive users should not be listed."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.UserFactory(email="john.doe@example.com", is_active=False)
    lennon = factories.UserFactory(email="john.lennon@example.com")

    response = client.get("/api/v1.0/users/?q=john.")

    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(lennon.id)]


def test_api_users_retrieve_me_anonymous():
    """Anonymous users should not be allowed to list users."""
    factories.UserFactory.create_batch(2)
    client = APIClient()
    response = client.get("/api/v1.0/users/me/")
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_users_retrieve_me_authenticated():
    """Authenticated users should be able to retrieve their own user via the "/users/me" path."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    factories.UserFactory.create_batch(2)
    response = client.get(
        "/api/v1.0/users/me/",
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "language": user.language,
        "short_name": user.short_name,
    }


def test_api_users_retrieve_anonymous():
    """Anonymous users should not be allowed to retrieve a user."""
    client = APIClient()
    user = factories.UserFactory()
    response = client.get(f"/api/v1.0/users/{user.id!s}/")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_users_retrieve_authenticated_self():
    """
    Authenticated users should be allowed to retrieve their own user.
    The returned object should not contain the password.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    response = client.get(
        f"/api/v1.0/users/{user.id!s}/",
    )
    assert response.status_code == 405
    assert response.json() == {"detail": 'Method "GET" not allowed.'}


def test_api_users_retrieve_authenticated_other():
    """
    Authenticated users should be able to retrieve another user's detail view with
    limited information.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()

    response = client.get(
        f"/api/v1.0/users/{other_user.id!s}/",
    )
    assert response.status_code == 405
    assert response.json() == {"detail": 'Method "GET" not allowed.'}


def test_api_users_create_anonymous():
    """Anonymous users should not be able to create users via the API."""
    response = APIClient().post(
        "/api/v1.0/users/",
        {
            "language": "fr-fr",
            "password": "mypassword",
        },
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }
    assert models.User.objects.exists() is False


def test_api_users_create_authenticated():
    """Authenticated users should not be able to create users via the API."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    response = client.post(
        "/api/v1.0/users/",
        {
            "language": "fr-fr",
            "password": "mypassword",
        },
        format="json",
    )
    assert response.status_code == 405
    assert response.json() == {"detail": 'Method "POST" not allowed.'}
    assert models.User.objects.exclude(id=user.id).exists() is False


def test_api_users_update_anonymous():
    """Anonymous users should not be able to update users via the API."""
    user = factories.UserFactory()

    old_user_values = dict(serializers.UserSerializer(instance=user).data)
    new_user_values = serializers.UserSerializer(instance=factories.UserFactory()).data

    response = APIClient().put(
        f"/api/v1.0/users/{user.id!s}/",
        new_user_values,
        format="json",
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }

    user.refresh_from_db()
    user_values = dict(serializers.UserSerializer(instance=user).data)
    for key, value in user_values.items():
        assert value == old_user_values[key]


def test_api_users_update_authenticated_self():
    """
    Authenticated users should be able to update their own user but only "language"
    and "timezone" fields.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    old_user_values = dict(serializers.UserSerializer(instance=user).data)
    new_user_values = dict(
        serializers.UserSerializer(instance=factories.UserFactory()).data
    )

    response = client.put(
        f"/api/v1.0/users/{user.id!s}/",
        new_user_values,
        format="json",
    )

    assert response.status_code == 200
    user.refresh_from_db()
    user_values = dict(serializers.UserSerializer(instance=user).data)
    for key, value in user_values.items():
        if key in ["language", "timezone"]:
            assert value == new_user_values[key]
        else:
            assert value == old_user_values[key]


def test_api_users_update_authenticated_other():
    """Authenticated users should not be allowed to update other users."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    user = factories.UserFactory()
    old_user_values = dict(serializers.UserSerializer(instance=user).data)
    new_user_values = serializers.UserSerializer(instance=factories.UserFactory()).data

    response = client.put(
        f"/api/v1.0/users/{user.id!s}/",
        new_user_values,
        format="json",
    )

    assert response.status_code == 403
    user.refresh_from_db()
    user_values = dict(serializers.UserSerializer(instance=user).data)
    for key, value in user_values.items():
        assert value == old_user_values[key]


def test_api_users_patch_anonymous():
    """Anonymous users should not be able to patch users via the API."""
    user = factories.UserFactory()

    old_user_values = dict(serializers.UserSerializer(instance=user).data)
    new_user_values = dict(
        serializers.UserSerializer(instance=factories.UserFactory()).data
    )

    for key, new_value in new_user_values.items():
        response = APIClient().patch(
            f"/api/v1.0/users/{user.id!s}/",
            {key: new_value},
            format="json",
        )
        assert response.status_code == 401
        assert response.json() == {
            "detail": "Authentication credentials were not provided."
        }

    user.refresh_from_db()
    user_values = dict(serializers.UserSerializer(instance=user).data)
    for key, value in user_values.items():
        assert value == old_user_values[key]


def test_api_users_patch_authenticated_self():
    """
    Authenticated users should be able to patch their own user but only "language"
    and "timezone" fields.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    old_user_values = dict(serializers.UserSerializer(instance=user).data)
    new_user_values = dict(
        serializers.UserSerializer(instance=factories.UserFactory()).data
    )

    for key, new_value in new_user_values.items():
        response = client.patch(
            f"/api/v1.0/users/{user.id!s}/",
            {key: new_value},
            format="json",
        )
        assert response.status_code == 200

    user.refresh_from_db()
    user_values = dict(serializers.UserSerializer(instance=user).data)
    for key, value in user_values.items():
        if key in ["language", "timezone"]:
            assert value == new_user_values[key]
        else:
            assert value == old_user_values[key]


def test_api_users_patch_authenticated_other():
    """Authenticated users should not be allowed to patch other users."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    user = factories.UserFactory()
    old_user_values = dict(serializers.UserSerializer(instance=user).data)
    new_user_values = dict(
        serializers.UserSerializer(instance=factories.UserFactory()).data
    )

    for key, new_value in new_user_values.items():
        response = client.put(
            f"/api/v1.0/users/{user.id!s}/",
            {key: new_value},
            format="json",
        )
        assert response.status_code == 403

    user.refresh_from_db()
    user_values = dict(serializers.UserSerializer(instance=user).data)
    for key, value in user_values.items():
        assert value == old_user_values[key]


def test_api_users_delete_list_anonymous():
    """Anonymous users should not be allowed to delete a list of users."""
    factories.UserFactory.create_batch(2)

    client = APIClient()
    response = client.delete("/api/v1.0/users/")

    assert response.status_code == 401
    assert models.User.objects.count() == 2


def test_api_users_delete_list_authenticated():
    """Authenticated users should not be allowed to delete a list of users."""
    factories.UserFactory.create_batch(2)
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    response = client.delete(
        "/api/v1.0/users/",
    )

    assert response.status_code == 405
    assert models.User.objects.count() == 3


def test_api_users_delete_anonymous():
    """Anonymous users should not be allowed to delete a user."""
    user = factories.UserFactory()

    response = APIClient().delete(f"/api/v1.0/users/{user.id!s}/")

    assert response.status_code == 401
    assert models.User.objects.count() == 1


def test_api_users_delete_authenticated():
    """
    Authenticated users should not be allowed to delete a user other than themselves.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()

    response = client.delete(
        f"/api/v1.0/users/{other_user.id!s}/",
    )

    assert response.status_code == 405
    assert models.User.objects.count() == 2


def test_api_users_delete_self():
    """Authenticated users should not be able to delete their own user."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    response = client.delete(
        f"/api/v1.0/users/{user.id!s}/",
    )

    assert response.status_code == 405
    assert models.User.objects.count() == 1
