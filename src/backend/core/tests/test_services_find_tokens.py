"""
Tests of the Find tokens exchanged with Menshen at login and revoked at logout
"""

import logging
import time
from importlib import import_module
from unittest import mock

from django.conf import settings as django_settings
from django.contrib import auth
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory

import pytest
from cryptography.fernet import Fernet
from waffle.testutils import override_flag

from core import factories
from core.enums import FeatureFlag
from core.services import find_tokens
from core.services.menshen_services import APIError, ExchangedToken

pytestmark = pytest.mark.django_db

SESSION_AGE = 5 * 24 * 3600
ENCRYPTION_KEY = Fernet.generate_key().decode()


@pytest.fixture(name="find_settings")
def find_settings_fixture(indexer_settings):
    """Configure the Find indexer and the exchange of the Find tokens."""
    indexer_settings.FIND_AUDIENCE = "find-development"
    indexer_settings.FIND_SEARCH_ACTION_SCOPE = "action:search-find-docs-development"
    indexer_settings.FIND_TOKEN_ENCRYPTION_KEY = ENCRYPTION_KEY
    indexer_settings.SESSION_COOKIE_AGE = SESSION_AGE
    return indexer_settings


@pytest.fixture(name="flag")
def flag_fixture():
    """Activate the full text search for every user."""
    with override_flag(FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH, active=True):
        yield


@pytest.fixture(name="mock_exchange")
def mock_exchange_fixture():
    """Menshen exchanges the tokens for the lifetime of a session."""
    with mock.patch.object(
        find_tokens.menshen_services,
        "exchange_token",
        return_value=ExchangedToken(access_token="find-token", expires_in=SESSION_AGE),
    ) as mocked:
        yield mocked


@pytest.fixture(name="mock_revoke")
def mock_revoke_fixture():
    """Menshen revokes the tokens."""
    with mock.patch.object(find_tokens.menshen_services, "revoke_token") as mocked:
        yield mocked


def login(user, **session_data):
    """Log a user in, as the OIDC callback does once the tokens are stored."""
    request = RequestFactory().get("/")
    request.session = import_module(django_settings.SESSION_ENGINE).SessionStore()
    request.session.update(session_data)
    request.user = AnonymousUser()
    auth.login(
        request, user, backend="core.authentication.backends.OIDCAuthenticationBackend"
    )
    return request


def decrypt(value):
    """Decrypt a Find token as kept in a session."""
    return Fernet(ENCRYPTION_KEY).decrypt(value.encode()).decode()


# Login


@pytest.mark.usefixtures("find_settings", "flag")
def test_find_tokens_exchanged_at_login(mock_exchange):
    """The fresh access token should be exchanged, the Find token kept encrypted."""
    before = time.time()
    request = login(factories.UserFactory(), oidc_access_token="idp-access-token")

    mock_exchange.assert_called_once_with(
        "idp-access-token", "find-development", "action:search-find-docs-development"
    )
    encrypted = request.session["find_access_token"]
    assert "find-token" not in encrypted
    assert decrypt(encrypted) == "find-token"
    expiration = request.session["find_access_token_expiration"]
    assert before + SESSION_AGE <= expiration <= time.time() + SESSION_AGE
    assert find_tokens.get_find_token(request.session) == "find-token"


@pytest.mark.parametrize(
    "indexer_configured, flag_active",
    [(True, False), (False, True), (False, False)],
)
def test_find_tokens_not_exchanged_without_find_search(
    indexer_configured, flag_active, settings, mock_exchange, request
):
    """
    The token should be exchanged if, and only if, the Find indexer is configured
    and the full text search flag is active for the user.
    """
    if indexer_configured:
        request.getfixturevalue("find_settings")
    else:
        settings.FIND_AUDIENCE = "find-development"
        settings.FIND_SEARCH_ACTION_SCOPE = "action:search-find-docs-development"
        settings.FIND_TOKEN_ENCRYPTION_KEY = ENCRYPTION_KEY

    with override_flag(FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH, active=flag_active):
        login_request = login(
            factories.UserFactory(), oidc_access_token="idp-access-token"
        )

    assert not mock_exchange.called
    assert "find_access_token" not in login_request.session


@pytest.mark.usefixtures("find_settings", "flag")
def test_find_tokens_no_access_token_at_login(mock_exchange, caplog):
    """Without an access token in the session, there is nothing to exchange."""
    with caplog.at_level(logging.WARNING, logger="core.services.find_tokens"):
        request = login(factories.UserFactory())

    assert not mock_exchange.called
    assert "find_access_token" not in request.session
    assert "is OIDC_STORE_ACCESS_TOKEN enabled?" in caplog.text


@pytest.mark.usefixtures("find_settings", "flag")
def test_find_tokens_menshen_failing_at_login(mock_exchange, caplog):
    """A failure of Menshen should be logged and never break the login."""
    mock_exchange.side_effect = APIError("Menshen answered 503", status_code=503)
    user = factories.UserFactory()

    with caplog.at_level(logging.ERROR, logger="core.services.find_tokens"):
        request = login(user, oidc_access_token="idp-access-token")

    assert request.user == user
    assert request.session[auth.SESSION_KEY] == str(user.pk)
    assert "find_access_token" not in request.session
    assert "Could not get a Find token at login: Menshen answered 503" in caplog.text


@pytest.mark.parametrize(
    "setting, value",
    [
        ("FIND_AUDIENCE", None),
        ("FIND_SEARCH_ACTION_SCOPE", None),
        ("FIND_TOKEN_ENCRYPTION_KEY", None),
        ("FIND_TOKEN_ENCRYPTION_KEY", "not-a-fernet-key"),
    ],
)
@pytest.mark.usefixtures("flag")
def test_find_tokens_not_configured_at_login(
    setting, value, find_settings, mock_exchange, caplog
):
    """A missing setting should be logged, Menshen not called, the login kept."""
    setattr(find_settings, setting, value)

    with caplog.at_level(logging.ERROR, logger="core.services.find_tokens"):
        request = login(factories.UserFactory(), oidc_access_token="idp-access-token")

    assert not mock_exchange.called
    assert "find_access_token" not in request.session
    assert setting in caplog.text


@pytest.mark.usefixtures("find_settings", "flag")
def test_find_tokens_shorter_than_the_session(mock_exchange, caplog):
    """A Find token expiring before the session should be kept, with a warning."""
    mock_exchange.return_value = ExchangedToken(
        access_token="find-token", expires_in=3600
    )

    with caplog.at_level(logging.WARNING, logger="core.services.find_tokens"):
        request = login(factories.UserFactory(), oidc_access_token="idp-access-token")

    assert decrypt(request.session["find_access_token"]) == "find-token"
    assert "Menshen granted a Find token for 3600 seconds" in caplog.text


@pytest.mark.usefixtures("find_settings", "flag")
def test_find_tokens_replaced_at_a_new_login(mock_exchange, mock_revoke):
    """Logging in again should replace the Find token and revoke the previous one."""
    user = factories.UserFactory()
    request = login(user, oidc_access_token="idp-access-token")
    mock_exchange.return_value = ExchangedToken(
        access_token="new-find-token", expires_in=SESSION_AGE
    )

    auth.login(
        request, user, backend="core.authentication.backends.OIDCAuthenticationBackend"
    )

    assert find_tokens.get_find_token(request.session) == "new-find-token"
    mock_revoke.assert_called_once_with("find-token")


def test_find_tokens_default_audience_and_scope():
    """The defaults should be the names documented by Find and Menshen for Docs."""
    assert django_settings.FIND_AUDIENCE == "find"
    assert django_settings.FIND_SEARCH_ACTION_SCOPE == "action:search-find-docs"


# Reading the token


@pytest.mark.usefixtures("find_settings")
def test_find_tokens_get_find_token():
    """The Find token should only be returned while it is valid and readable."""
    session = {}
    assert find_tokens.get_find_token(session) is None

    session["find_access_token"] = (
        Fernet(ENCRYPTION_KEY).encrypt(b"find-token").decode()
    )
    session["find_access_token_expiration"] = time.time() + 60
    assert find_tokens.get_find_token(session) == "find-token"

    session["find_access_token_expiration"] = time.time() - 1
    assert find_tokens.get_find_token(session) is None


def test_find_tokens_get_find_token_undecryptable(find_settings, caplog):
    """A Find token encrypted with another key should be ignored."""
    session = {
        "find_access_token": Fernet(Fernet.generate_key()).encrypt(b"t").decode(),
        "find_access_token_expiration": time.time() + 60,
    }
    with caplog.at_level(logging.WARNING, logger="core.services.find_tokens"):
        assert find_tokens.get_find_token(session) is None
    assert "cannot be decrypted" in caplog.text

    find_settings.FIND_TOKEN_ENCRYPTION_KEY = None
    assert find_tokens.get_find_token(session) is None


# Logout


@pytest.mark.usefixtures("find_settings", "flag", "mock_exchange")
def test_find_tokens_revoked_at_logout(mock_revoke):
    """Logging out should revoke the Find token, then flush the session."""
    request = login(factories.UserFactory(), oidc_access_token="idp-access-token")

    auth.logout(request)

    mock_revoke.assert_called_once_with("find-token")
    assert "find_access_token" not in request.session


@pytest.mark.usefixtures("find_settings", "flag", "mock_exchange")
def test_find_tokens_menshen_failing_at_logout(mock_revoke, caplog):
    """A failure of Menshen should be logged and never break the logout."""
    mock_revoke.side_effect = APIError("Menshen answered 503", status_code=503)
    request = login(factories.UserFactory(), oidc_access_token="idp-access-token")

    with caplog.at_level(logging.ERROR, logger="core.services.find_tokens"):
        auth.logout(request)

    assert auth.SESSION_KEY not in request.session
    assert "Could not revoke a Find token: Menshen answered 503" in caplog.text


@pytest.mark.usefixtures("find_settings", "flag", "mock_exchange")
def test_find_tokens_not_revoked_once_expired(mock_revoke):
    """An expired Find token is no longer usable: there is nothing to revoke."""
    request = login(factories.UserFactory(), oidc_access_token="idp-access-token")
    request.session["find_access_token_expiration"] = time.time() - 1

    auth.logout(request)

    assert not mock_revoke.called


@pytest.mark.usefixtures("find_settings")
def test_find_tokens_nothing_to_revoke_at_logout(mock_revoke):
    """A session without a Find token should log out without calling Menshen."""
    request = login(factories.UserFactory(), oidc_access_token="idp-access-token")

    auth.logout(request)

    assert not mock_revoke.called
