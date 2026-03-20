"""Unit tests for the refresh_access_token utility function."""

import pytest
import responses
from cryptography.fernet import Fernet
from lasuite.oidc_login.backends import get_oidc_refresh_token, store_tokens
from requests import HTTPError
from rest_framework.exceptions import AuthenticationFailed

from core.api.utils import refresh_access_token

pytestmark = pytest.mark.django_db


@pytest.fixture(name="mock_oidc_settings")
def mock_oidc_settings_fixture(settings):
    """Fixture to mock OIDC settings."""
    settings.OIDC_OP_TOKEN_ENDPOINT = "https://example.com/token"
    settings.OIDC_RP_CLIENT_ID = "test-client-id"
    settings.OIDC_RP_CLIENT_SECRET = "test-client-secret"
    settings.OIDC_STORE_REFRESH_TOKEN = True
    settings.OIDC_STORE_REFRESH_TOKEN_KEY = Fernet.generate_key()
    yield settings


@responses.activate
def test_refresh_access_token_success(mock_oidc_settings):  # pylint: disable=unused-argument
    """Test successful token refresh."""
    session = {}
    store_tokens(
        session,
        access_token="old-access-token",
        id_token=None,
        refresh_token="valid-refresh-token",
    )

    responses.add(
        responses.POST,
        "https://example.com/token",
        json={
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
        },
        status=200,
    )

    result = refresh_access_token(session)

    assert result == session
    assert get_oidc_refresh_token(session) == "new-refresh-token"


def test_refresh_access_token_missing_refresh_token(mock_oidc_settings):  # pylint: disable=unused-argument
    """Test that AuthenticationFailed is raised when refresh token is missing."""
    session = {}

    with pytest.raises(AuthenticationFailed) as exc_info:
        refresh_access_token(session)

    assert exc_info.value.detail == {"error": "Refresh token is missing from session"}


@responses.activate
def test_refresh_access_token_http_error(mock_oidc_settings):  # pylint: disable=unused-argument
    """Test that HTTP errors are propagated when token endpoint fails."""
    session = {}
    store_tokens(
        session,
        access_token="old-access-token",
        id_token=None,
        refresh_token="valid-refresh-token",
    )

    responses.add(
        responses.POST,
        "https://example.com/token",
        json={"error": "invalid_grant"},
        status=401,
    )

    with pytest.raises(HTTPError):
        refresh_access_token(session)
