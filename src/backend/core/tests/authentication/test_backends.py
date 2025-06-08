"""Unit tests for the Authentication Backends."""

import random
import re

from django.core.exceptions import SuspiciousOperation
from django.test.utils import override_settings

import pytest
import responses
from cryptography.fernet import Fernet
from lasuite.oidc_login.backends import get_oidc_refresh_token

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

    with django_assert_num_queries(3):  # user by sub, user by mail, update sub
        user = klass.get_or_create_user(
            access_token="test-token", id_token=None, payload=None
        )

    assert user == db_user


def test_authentication_getter_email_none(monkeypatch):
    """
    If no user is found with the sub and no email is provided, a new user should be created.
    """

    klass = OIDCAuthenticationBackend()
    db_user = UserFactory(email=None)

    def get_userinfo_mocked(*args):
        user_info = {"sub": "123"}
        if random.choice([True, False]):
            user_info["email"] = None
        return user_info

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    user = klass.get_or_create_user(
        access_token="test-token", id_token=None, payload=None
    )

    # Since the sub and email didn't match, it should create a new user
    assert models.User.objects.count() == 2
    assert user != db_user
    assert user.sub == "123"


def test_authentication_getter_existing_user_no_fallback_to_email_allow_duplicate(
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
    settings.OIDC_ALLOW_DUPLICATE_EMAILS = True

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


def test_authentication_getter_existing_user_no_fallback_to_email_no_duplicate(
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
    settings.OIDC_ALLOW_DUPLICATE_EMAILS = False

    def get_userinfo_mocked(*args):
        return {"sub": "123", "email": db_user.email}

    monkeypatch.setattr(OIDCAuthenticationBackend, "get_userinfo", get_userinfo_mocked)

    with pytest.raises(
        SuspiciousOperation,
        match=(
            "We couldn't find a user with this sub but the email is already associated "
            "with a registered user."
        ),
    ):
        klass.get_or_create_user(access_token="test-token", id_token=None, payload=None)

    # Since the sub doesn't match, it should not create a new user
    assert models.User.objects.count() == 1


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
    assert user.has_usable_password() is False
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
    assert user.has_usable_password() is False
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
def test_authentication_get_userinfo_token_response(monkeypatch, settings):
    """Test get_userinfo method with a token response."""
    settings.OIDC_RP_SIGN_ALGO = "HS256"  # disable JWKS URL call
    responses.add(
        responses.GET,
        re.compile(r".*/userinfo"),
        body="fake.jwt.token",
        status=200,
        content_type="application/jwt",
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
def test_authentication_get_userinfo_invalid_response(settings):
    """
    Test get_userinfo method with an invalid JWT response that
    causes verify_token to raise an error.
    """
    settings.OIDC_RP_SIGN_ALGO = "HS256"  # disable JWKS URL call
    responses.add(
        responses.GET,
        re.compile(r".*/userinfo"),
        body="fake.jwt.token",
        status=200,
        content_type="application/jwt",
    )

    oidc_backend = OIDCAuthenticationBackend()

    with pytest.raises(
        SuspiciousOperation,
        match="User info response was not valid JWT",
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


@responses.activate
def test_authentication_session_tokens(
    django_assert_num_queries, monkeypatch, rf, settings
):
    """
    Test that the session contains oidc_refresh_token and oidc_access_token after authentication.
    """
    settings.OIDC_OP_TOKEN_ENDPOINT = "http://oidc.endpoint.test/token"
    settings.OIDC_OP_USER_ENDPOINT = "http://oidc.endpoint.test/userinfo"
    settings.OIDC_OP_JWKS_ENDPOINT = "http://oidc.endpoint.test/jwks"
    settings.OIDC_STORE_ACCESS_TOKEN = True
    settings.OIDC_STORE_REFRESH_TOKEN = True
    settings.OIDC_STORE_REFRESH_TOKEN_KEY = Fernet.generate_key()

    klass = OIDCAuthenticationBackend()
    request = rf.get("/some-url", {"state": "test-state", "code": "test-code"})
    request.session = {}

    def verify_token_mocked(*args, **kwargs):
        return {"sub": "123", "email": "test@example.com"}

    monkeypatch.setattr(OIDCAuthenticationBackend, "verify_token", verify_token_mocked)

    responses.add(
        responses.POST,
        re.compile(settings.OIDC_OP_TOKEN_ENDPOINT),
        json={
            "access_token": "test-access-token",
            "refresh_token": "test-refresh-token",
        },
        status=200,
    )

    responses.add(
        responses.GET,
        re.compile(settings.OIDC_OP_USER_ENDPOINT),
        json={"sub": "123", "email": "test@example.com"},
        status=200,
    )

    with django_assert_num_queries(6):
        user = klass.authenticate(
            request,
            code="test-code",
            nonce="test-nonce",
            code_verifier="test-code-verifier",
        )

    assert user is not None
    assert request.session["oidc_access_token"] == "test-access-token"
    assert get_oidc_refresh_token(request.session) == "test-refresh-token"
