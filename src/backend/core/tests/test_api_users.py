"""
Test users API endpoints in the impress core app.
"""

from django.utils import timezone

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


def test_api_users_list_query_email_with_internationalized_domain_names():
    """
    Authenticated users should be able to list users and filter by email.
    It should work even if the email address contains an internationalized domain name.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    jean = factories.UserFactory(email="jean.martin@éducation.fr")
    marie = factories.UserFactory(email="marie.durand@education.fr")
    kurokawa = factories.UserFactory(email="contact@黒川.日本")

    response = client.get("/api/v1.0/users/?q=jean.martin@education.fr")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(jean.id)]

    response = client.get("/api/v1.0/users/?q=jean.martin@éducation.fr")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(jean.id)]

    response = client.get("/api/v1.0/users/?q=marie.durand@education.fr")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(marie.id)]

    response = client.get("/api/v1.0/users/?q=marie.durand@éducation.fr")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(marie.id)]

    response = client.get("/api/v1.0/users/?q=contact@黒川.日本")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(kurokawa.id)]


def test_api_users_list_query_full_name():
    """
    Authenticated users should be able to list users and filter by full name.
    Only results with a Trigram similarity greater than 0.2 with the query should be returned.
    """
    user = factories.UserFactory(email="user@example.com")

    client = APIClient()
    client.force_login(user)

    dave = factories.UserFactory(email="contact@example.com", full_name="David Bowman")

    response = client.get(
        "/api/v1.0/users/?q=David",
    )
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(dave.id)]

    response = client.get("/api/v1.0/users/?q=Bowman")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(dave.id)]

    response = client.get("/api/v1.0/users/?q=bowman")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(dave.id)]

    response = client.get("/api/v1.0/users/?q=BOWMAN")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(dave.id)]

    response = client.get("/api/v1.0/users/?q=BoWmAn")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(dave.id)]

    response = client.get("/api/v1.0/users/?q=Bovin")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == []


def test_api_users_list_query_accented_full_name():
    """
    Authenticated users should be able to list users and filter by full name with accents.
    Only results with a Trigram similarity greater than 0.2 with the query should be returned.
    """
    user = factories.UserFactory(email="user@example.com")

    client = APIClient()
    client.force_login(user)

    fred = factories.UserFactory(
        email="contact@example.com", full_name="Frédérique Lefèvre"
    )

    response = client.get("/api/v1.0/users/?q=Frédérique")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(fred.id)]

    response = client.get("/api/v1.0/users/?q=Frederique")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(fred.id)]

    response = client.get("/api/v1.0/users/?q=Lefèvre")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(fred.id)]

    response = client.get("/api/v1.0/users/?q=Lefevre")
    assert response.status_code == 200
    user_ids = [user["id"] for user in response.json()]
    assert user_ids == [str(fred.id)]

    response = client.get("/api/v1.0/users/?q=François Lorfebvre")
    assert response.status_code == 200
    users = [user["full_name"] for user in response.json()]
    assert users == []


def test_api_users_list_sorted_by_closest_match():
    """
    Authenticated users should be able to list users and the results should be
    sorted by closest match to the query.

    Sorting criteria are :
    - Shared documents with the user (most recent first)
    - Same full email domain (example.gouv.fr)

    Addresses that match neither criteria should be excluded from the results.

        Case in point: the logged-in user has recently shared documents
    with pierre.dupont@beta.gouv.fr and less recently with pierre.durand@impots.gouv.fr.

    Other users named Pierre also exist:
    - pierre.thomas@example.com
    - pierre.petit@anct.gouv.fr
    - pierre.robert@culture.gouv.fr

    The search results should be ordered as follows:

    # Shared with first
    - pierre.dupond@beta.gouv.fr # Most recent first
    - pierre.durand@impots.gouv.fr
    # Same full domain second
    - pierre.petit@anct.gouv.fr
    """

    user = factories.UserFactory(
        email="martin.bernard@anct.gouv.fr", full_name="Martin Bernard"
    )

    client = APIClient()
    client.force_login(user)

    pierre_1 = factories.UserFactory(email="pierre.dupont@beta.gouv.fr")
    pierre_2 = factories.UserFactory(email="pierre.durand@impots.gouv.fr")
    _pierre_3 = factories.UserFactory(email="pierre.thomas@example.com")
    pierre_4 = factories.UserFactory(email="pierre.petit@anct.gouv.fr")
    _pierre_5 = factories.UserFactory(email="pierre.robert@culture.gouv.fr")

    document_1 = factories.DocumentFactory(creator=user)
    document_2 = factories.DocumentFactory(creator=user)
    factories.UserDocumentAccessFactory(user=user, document=document_1)
    factories.UserDocumentAccessFactory(user=user, document=document_2)

    now = timezone.now()
    last_week = now - timezone.timedelta(days=7)
    last_month = now - timezone.timedelta(days=30)

    # The factory cannot set the created_at directly, so we force it after creation
    p1_d1 = factories.UserDocumentAccessFactory(user=pierre_1, document=document_1)
    p1_d1.created_at = last_week
    p1_d1.save()

    p2_d2 = factories.UserDocumentAccessFactory(user=pierre_2, document=document_2)
    p2_d2.created_at = last_month
    p2_d2.save()

    response = client.get("/api/v1.0/users/?q=Pierre")
    assert response.status_code == 200
    user_ids = [user["email"] for user in response.json()]

    assert user_ids == [
        str(pierre_1.email),
        str(pierre_2.email),
        str(pierre_4.email),
    ]


def test_api_users_list_limit(settings):
    """
    Authenticated users should be able to list users and the number of results
    should be limited to API_USERS_LIST_LIMIT (by default 5).
    """
    user = factories.UserFactory(email="user@example.com")

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
    If API_USERS_SEARCH_QUERY_MIN_LENGTH is not set, the default minimum length should be 3.
    """
    user = factories.UserFactory(email="paul@example.com", full_name="Paul")
    client = APIClient()
    client.force_login(user)

    factories.UserFactory(email="john.doe@example.com", full_name="John Doe")
    factories.UserFactory(email="john.lennon@example.com", full_name="John Lennon")

    response = client.get("/api/v1.0/users/?q=joh")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_api_users_list_query_long_queries():
    """
    Queries longer than 255 characters should return an empty result set.
    """
    user = factories.UserFactory(email="paul@example.com")
    client = APIClient()
    client.force_login(user)

    factories.UserFactory(email="john.doe@example.com")
    factories.UserFactory(email="john.lennon@example.com")

    query = "a" * 244
    response = client.get(f"/api/v1.0/users/?q={query}@example.com")
    assert response.status_code == 400
    assert response.json() == {
        "q": ["Ensure this value has at most 254 characters (it has 256)."]
    }


def test_api_users_list_query_inactive():
    """Inactive users should not be listed."""
    user = factories.UserFactory(email="user@example.com")
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
        "is_first_connection": True,
    }


def test_api_users_retrieve_me_authenticated_empty_name():
    """
    Authenticated users should be able to retrieve their own user via the "/users/me" path.
    when no name is provided, the full name and short name should be the email without the domain.
    """
    user = factories.UserFactory(
        email="test_foo@test.com",
        full_name=None,
        short_name=None,
    )

    client = APIClient()
    client.force_login(user)

    factories.UserFactory.create_batch(2)
    response = client.get(
        "/api/v1.0/users/me/",
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(user.id),
        "email": "test_foo@test.com",
        "full_name": "test_foo",
        "language": user.language,
        "short_name": "test_foo",
        "is_first_connection": True,
    }


def test_api_users_retrieve_me_second_request():
    """
    On a second request, the is_first_connection flag should return False.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    # First request: flag should be True
    response = client.get("/api/v1.0/users/me/")
    assert response.status_code == 200
    assert response.json()["is_first_connection"] is True

    # Second request: flag should be False
    response = client.get("/api/v1.0/users/me/")
    assert response.status_code == 200
    assert response.json()["is_first_connection"] is False


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
