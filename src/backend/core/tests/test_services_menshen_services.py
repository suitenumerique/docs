"""
Unit tests for the Menshen services
"""

from unittest import mock

import httpx2
import pytest
from menshen_client import Configuration, TokenExchangeClient

from core.services.menshen_services import (
    APIError,
    ConfigurationError,
    ExchangedToken,
    exchange_token,
    revoke_token,
)

MENSHEN_URL = "http://menshen:8000"
EXCHANGE_URL = f"{MENSHEN_URL}/auth/token/exchange/"
REVOKE_URL = f"{MENSHEN_URL}/auth/token/revoke/"

EXCHANGE_RESPONSE = {
    "access_token": "exchanged-token",
    "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
    "token_type": "bearer",
    "expires_in": 432000,
    "scope": "find:docs:search",
    "grants": [{"audience_id": "find", "scope": "find:docs:search"}],
}


@pytest.fixture(autouse=True)
def menshen_settings(settings):
    """Configure Menshen."""
    settings.MENSHEN_URL = MENSHEN_URL
    settings.MENSHEN_CLIENT_ID = "docs"
    settings.MENSHEN_CLIENT_SECRET = "docs-secret"
    settings.MENSHEN_TIMEOUT = 3.0
    return settings


def menshen_response(url, status_code=200, **kwargs):
    """An answer of Menshen to a POST on `url`."""
    return httpx2.Response(status_code, request=httpx2.Request("POST", url), **kwargs)


@mock.patch.object(httpx2.Client, "post")
def test_services_menshen_exchange_token(mock_post):
    """The access token of the user should be exchanged for the given audience and scope."""
    mock_post.return_value = menshen_response(EXCHANGE_URL, json=EXCHANGE_RESPONSE)

    token = exchange_token("user-access-token", "find", "action:search-find-docs")

    assert token == ExchangedToken(access_token="exchanged-token", expires_in=432000)
    mock_post.assert_called_once_with(
        EXCHANGE_URL,
        data={
            "subject_token": "user-access-token",
            "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "audience": "find",
            "scope": "action:search-find-docs",
        },
    )


@pytest.mark.parametrize(
    "answer",
    [
        menshen_response(EXCHANGE_URL, json=EXCHANGE_RESPONSE),
        menshen_response(EXCHANGE_URL, status_code=400, json={"error": "invalid"}),
        httpx2.ConnectError("refused"),
    ],
)
def test_services_menshen_client_opened_and_closed_for_each_call(answer):
    """
    Each call should open a client configured from the settings, and close it,
    whatever Menshen answers: nothing is shared between the calls.
    """
    with (
        mock.patch(
            "core.services.menshen_services.TokenExchangeClient",
            wraps=TokenExchangeClient,
        ) as mock_client,
        mock.patch.object(httpx2.Client, "post") as mock_post,
        mock.patch.object(httpx2.Client, "close") as mock_close,
    ):
        if isinstance(answer, Exception):
            mock_post.side_effect = answer
        else:
            mock_post.return_value = answer

        for _ in range(2):
            try:
                exchange_token("user-access-token", "find", "action:search-find-docs")
            except APIError:
                pass

    assert mock_client.call_count == 2
    assert mock_client.call_args.args == (
        Configuration(
            client_id="docs",
            client_secret="docs-secret",
            server_root_url=MENSHEN_URL,
            requests_timeout=3.0,
        ),
    )
    assert mock_close.call_count == 2


@pytest.mark.parametrize(
    "setting", ["MENSHEN_URL", "MENSHEN_CLIENT_ID", "MENSHEN_CLIENT_SECRET"]
)
@mock.patch.object(httpx2.Client, "post")
def test_services_menshen_not_configured(mock_post, setting, settings):
    """Menshen should not be called when it is not configured."""
    setattr(settings, setting, None)

    with pytest.raises(ConfigurationError):
        exchange_token("user-access-token", "find", "action:search-find-docs")
    with pytest.raises(ConfigurationError):
        revoke_token("exchanged-token")

    assert not mock_post.called


@mock.patch.object(httpx2.Client, "post")
def test_services_menshen_exchange_token_refused(mock_post):
    """A refusal of Menshen should be raised with its status and its OAuth error."""
    mock_post.return_value = menshen_response(
        EXCHANGE_URL,
        status_code=400,
        json={"error": "invalid_grant", "error_description": "Token is not active"},
    )

    with pytest.raises(APIError) as excinfo:
        exchange_token("user-access-token", "find", "action:search-find-docs")

    assert excinfo.value.status_code == 400
    assert str(excinfo.value) == (
        "Menshen answered 400: invalid_grant (Token is not active)"
    )


@mock.patch.object(httpx2.Client, "post")
def test_services_menshen_exchange_token_server_error(mock_post):
    """An error answered without a JSON body should be raised with its status."""
    mock_post.return_value = menshen_response(
        EXCHANGE_URL, status_code=502, text="Bad Gateway"
    )

    with pytest.raises(APIError) as excinfo:
        exchange_token("user-access-token", "find", "action:search-find-docs")

    assert excinfo.value.status_code == 502
    assert str(excinfo.value) == "Menshen answered 502"


@pytest.mark.parametrize(
    "error",
    [
        httpx2.ConnectError("refused"),
        httpx2.ReadTimeout("too slow"),
    ],
)
@mock.patch.object(httpx2.Client, "post")
def test_services_menshen_exchange_token_unreachable(mock_post, error):
    """Menshen not answering should be raised as an API error without status."""
    mock_post.side_effect = error

    with pytest.raises(APIError) as excinfo:
        exchange_token("user-access-token", "find", "action:search-find-docs")

    assert excinfo.value.status_code is None
    assert excinfo.value.__cause__ is error


@mock.patch.object(httpx2.Client, "post")
def test_services_menshen_exchange_token_unparsable(mock_post):
    """An answer the client cannot parse should be raised as an API error."""
    mock_post.return_value = menshen_response(
        EXCHANGE_URL, json={"access_token": "exchanged-token"}
    )

    with pytest.raises(APIError) as excinfo:
        exchange_token("user-access-token", "find", "action:search-find-docs")

    assert excinfo.value.status_code is None


@mock.patch.object(httpx2.Client, "post")
def test_services_menshen_revoke_token(mock_post):
    """A token issued by Menshen should be revoked."""
    mock_post.return_value = menshen_response(REVOKE_URL)

    revoke_token("exchanged-token")

    mock_post.assert_called_once_with(REVOKE_URL, data={"token": "exchanged-token"})


@mock.patch.object(httpx2.Client, "post")
def test_services_menshen_revoke_token_refused(mock_post):
    """A failed revocation should be raised with its status."""
    mock_post.return_value = menshen_response(
        REVOKE_URL, status_code=401, json={"error": "invalid_client"}
    )

    with pytest.raises(APIError) as excinfo:
        revoke_token("exchanged-token")

    assert excinfo.value.status_code == 401
    assert str(excinfo.value) == "Menshen answered 401: invalid_client"
