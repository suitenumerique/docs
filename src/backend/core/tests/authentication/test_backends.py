"""Unit tests for the Authentication Backends."""

import re
from logging import Logger
from unittest import mock

from django.core.exceptions import SuspiciousOperation
from django.test.utils import override_settings

import pytest
import responses

from core import models
from core.authentication.backends import OIDCAuthenticationBackend
from core.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_authentication_getter_existing_user_no_email(
    django_assert_num_queries, monkeypatch
):
    """
    If an existing user matches the user's info sub, the user should be returned.
    """

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory()

    def get_userinfo_mocked(*args):
        return {"sub": db_user.sub}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with django_assert_num_queries(1):
        user = klass.get_or_create_user(
            access_token="test-token", id_token=None, payload=None
        )

    assert user == db_user


def test_authentication_getter_existing_user_via_email(
    django_assert_num_queries, monkeypatch
):
    """
    If an existing user doesn't match the sub but matches the email,
    the user should be returned.
    """

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory()

    def get_userinfo_mocked(*args):
        return {"sub": "123", "email": db_user.email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with django_assert_num_queries(2):
        user = klass.get_or_create_user(
            access_token="test-token", id_token=None, payload=None
        )

    assert user == db_user


def test_authentication_getter_existing_user_no_fallback_to_email(
    settings, monkeypatch
):
    """
    When the "OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION" setting is set to False,
    the system should not match users by email, even if the email matches.
    """

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory()

    # Set the setting to False
    settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION = False

    def get_userinfo_mocked(*args):
        return {"sub": "123", "email": db_user.email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    # Since the sub doesn't match, it should create a new user
    assert models.User.objects.count() == 2
    assert user != db_user
    assert user.sub == "123"


def test_authentication_getter_existing_user_with_email(
    django_assert_num_queries, monkeypatch
):
    """
    When the user's info contains an email and targets an existing user,
    """
    klass = OIDCAuthenticationBackend()
    user = UserFactory(full_name="John Doe", short_name="John")

    def get_userinfo_mocked(*args):
        return {
            "sub": user.sub,
            "email": user.email,
            "first_name": "John",
            "last_name": "Doe",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    # Only 1 query because email and names have not changed
    with django_assert_num_queries(1):
        authenticated_user = klass.get_or_create_user(
            access_token="test-token", id_token=None, payload=None
        )

    assert user == authenticated_user


@pytest.mark.parametrize(
    "first_name, last_name, email",
    [
        ("Jack", "Doe", "john.doe@example.com"),
        ("John", "Duy", "john.doe@example.com"),
        ("John", "Doe", "jack.duy@example.com"),
        ("Jack", "Duy", "jack.duy@example.com"),
    ],
)
def test_authentication_getter_existing_user_change_fields_sub(
    first_name, last_name, email, django_assert_num_queries, monkeypatch
):
    """
    It should update the email or name fields on the user when they change
    and the user was identified by its "sub".
    """
    klass = OIDCAuthenticationBackend()
    user = UserFactory(
        full_name="John Doe", short_name="John", email="john.doe@example.com"
    )

    def get_userinfo_mocked(*args):
        return {
            "sub": user.sub,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    # One and only one additional update query when a field has changed
    with django_assert_num_queries(2):
        authenticated_user = klass.get_or_create_user(
            access_token="test-token", id_token=None, payload=None
        )

    assert user == authenticated_user
    user.refresh_from_db()
    assert user.email == email
    assert user.full_name == f"{first_name:s} {last_name:s}"
    assert user.short_name == first_name


@pytest.mark.parametrize(
    "first_name, last_name, email",
    [
        ("Jack", "Doe", "john.doe@example.com"),
        ("John", "Duy", "john.doe@example.com"),
    ],
)
def test_authentication_getter_existing_user_change_fields_email(
    first_name, last_name, email, django_assert_num_queries, monkeypatch
):
    """
    It should update the name fields on the user when they change
    and the user was identified by its "email" as fallback.
    """
    klass = OIDCAuthenticationBackend()
    user = UserFactory(
        full_name="John Doe", short_name="John", email="john.doe@example.com"
    )

    def get_userinfo_mocked(*args):
        return {
            "sub": "123",
            "email": user.email,
            "first_name": first_name,
            "last_name": last_name,
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    # One and only one additional update query when a field has changed
    with django_assert_num_queries(3):
        authenticated_user = klass.get_or_create_user(
            access_token="test-token", id_token=None, payload=None
        )

    assert user == authenticated_user
    user.refresh_from_db()
    assert user.email == email
    assert user.full_name == f"{first_name:s} {last_name:s}"
    assert user.short_name == first_name


def test_authentication_getter_new_user_no_email(monkeypatch):
    """
    If no user matches the user's info sub, a user should be created.
    User's info doesn't contain an email, created user's email should be empty.
    """
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {"sub": "123"}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user.sub == "123"
    assert user.email is None
    assert user.full_name is None
    assert user.short_name is None
    assert user.password == "!"
    assert models.User.objects.count() == 1


def test_authentication_getter_new_user_with_email(monkeypatch):
    """
    If no user matches the user's info sub, a user should be created.
    User's email and name should be set on the identity.
    The "email" field on the User model should not be set as it is reserved for staff users.
    """
    klass = OIDCAuthenticationBackend()

    email = "impress@example.com"

    def get_userinfo_mocked(*args):
        return {"sub": "123", "email": email, "first_name": "John", "last_name": "Doe"}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    assert user.sub == "123"
    assert user.email == email
    assert user.full_name == "John Doe"
    assert user.short_name == "John"
    assert user.password == "!"
    assert models.User.objects.count() == 1


@override_settings(OIDC_OP_USER_ENDPOINT="http://oidc.endpoint.test/userinfo")
@responses.activate
def test_authentication_get_userinfo_json_response():
    """Test get_userinfo method with a JSON response."""

    responses.add(
        responses.GET,
        re.compile(r".*/userinfo"),
        json={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
        },
        status=200,
    )

    oidc_backend = OIDCAuthenticationBackend()
    result = oidc_backend.get_userinfo("fake_access_token", None, None)

    assert result["first_name"] == "John"
    assert result["last_name"] == "Doe"
    assert result["email"] == "john.doe@example.com"


@override_settings(OIDC_OP_USER_ENDPOINT="http://oidc.endpoint.test/userinfo")
@responses.activate
def test_authentication_get_userinfo_token_response(monkeypatch):
    """Test get_userinfo method with a token response."""

    responses.add(
        responses.GET, re.compile(r".*/userinfo"), body="fake.jwt.token", status=200
    )

    def mock_verify_token(self, token):  # pylint: disable=unused-argument
        return {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "verify_token", mock_verify_token)

    oidc_backend = OIDCAuthenticationBackend()
    result = oidc_backend.get_userinfo("fake_access_token", None, None)

    assert result["first_name"] == "Jane"
    assert result["last_name"] == "Doe"
    assert result["email"] == "jane.doe@example.com"


@override_settings(OIDC_OP_USER_ENDPOINT="http://oidc.endpoint.test/userinfo")
@responses.activate
def test_authentication_get_userinfo_invalid_response():
    """
    Test get_userinfo method with an invalid JWT response that
    causes verify_token to raise an error.
    """

    responses.add(
        responses.GET, re.compile(r".*/userinfo"), body="fake.jwt.token", status=200
    )

    oidc_backend = OIDCAuthenticationBackend()

    with pytest.raises(
        SuspiciousOperation,
        match="Invalid response format or token verification failed",
    ):
        oidc_backend.get_userinfo("fake_access_token", None, None)


def test_authentication_getter_existing_disabled_user_via_sub(
    django_assert_num_queries, monkeypatch
):
    """
    If an existing user matches the sub but is disabled,
    an error should be raised and a user should not be created.
    """

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(is_active=False)

    def get_userinfo_mocked(*args):
        return {
            "sub": db_user.sub,
            "email": db_user.email,
            "first_name": "John",
            "last_name": "Doe",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with (
        django_assert_num_queries(1),
        pytest.raises(SuspiciousOperation, match="User account is disabled"),
    ):
        klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    assert models.User.objects.count() == 1


def test_authentication_getter_existing_disabled_user_via_email(
    django_assert_num_queries, monkeypatch
):
    """
    If an existing user does not match the sub but matches the email and is disabled,
    an error should be raised and a user should not be created.
    """

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(is_active=False)

    def get_userinfo_mocked(*args):
        return {
            "sub": "random",
            "email": db_user.email,
            "first_name": "John",
            "last_name": "Doe",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with (
        django_assert_num_queries(2),
        pytest.raises(SuspiciousOperation, match="User account is disabled"),
    ):
        klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    assert models.User.objects.count() == 1


# Essential claims


def test_authentication_verify_claims_default(django_assert_num_queries, monkeypatch):
    """The sub claim should be mandatory by default."""
    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {
            "test": "123",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with (
        django_assert_num_queries(0),
        pytest.raises(
            KeyError,
            match="sub",
        ),
    ):
        klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    assert models.User.objects.exists() is False


@pytest.mark.parametrize(
    "essential_claims, missing_claims",
    [
        (["email", "sub"], ["email"]),
        (["Email", "sub"], ["Email"]),  # Case sensitivity
    ],
)
@override_settings(OIDC_OP_USER_ENDPOINT="http://oidc.endpoint.test/userinfo")
@mock.patch.object(Logger, "error")
def test_authentication_verify_claims_essential_missing(
    mock_logger,
    essential_claims,
    missing_claims,
    django_assert_num_queries,
    monkeypatch,
):
    """Ensure SuspiciousOperation is raised if essential claims are missing."""

    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {
            "sub": "123",
            "last_name": "Doe",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with (
        django_assert_num_queries(0),
        pytest.raises(
            SuspiciousOperation,
            match="Claims verification failed",
        ),
        override_settings(USER_OIDC_ESSENTIAL_CLAIMS=essential_claims),
    ):
        klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    assert models.User.objects.exists() is False
    mock_logger.assert_called_once_with("Missing essential claims: %s", missing_claims)


@override_settings(
    OIDC_OP_USER_ENDPOINT="http://oidc.endpoint.test/userinfo",
    USER_OIDC_ESSENTIAL_CLAIMS=["email", "last_name"],
)
def test_authentication_verify_claims_success(django_assert_num_queries, monkeypatch):
    """Ensure user is authenticated when all essential claims are present."""

    klass = OIDCAuthenticationBackend()

    def get_userinfo_mocked(*args):
        return {
            "email": "john.doe@example.com",
            "last_name": "Doe",
            "sub": "123",
        }

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with django_assert_num_queries(6):
        user = klass.get_or_create_user(
            access_token="test-token", id_token=None, payload=None
        )

    assert models.User.objects.filter(id=user.id).exists()

    assert user.sub == "123"
    assert user.full_name == "Doe"
    assert user.short_name is None
    assert user.email == "john.doe@example.com"
