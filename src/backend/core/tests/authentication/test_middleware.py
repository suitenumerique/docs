"""Unit tests for the OIDC Refresh Session Middleware."""

import re
import time
from unittest.mock import MagicMock

import pytest
import responses
from cryptography.fernet import Fernet
from lasuite.oidc_login.backends import (
    get_oidc_refresh_token,
    store_oidc_refresh_token,
)

from core.authentication.middleware import OIDCRefreshSessionMiddleware
from core.factories import UserFactory

pytestmark = pytest.mark.django_db


@responses.activate
def test_refresh_access_token_when_expired(rf, settings):
    """
    Test if the middleware refreshes the access token and updates the oidc_token_expiration field
    """
    settings.OIDC_OP_TOKEN_ENDPOINT = "http://oidc.endpoint.test/token"
    settings.OIDC_OP_AUTHORIZATION_ENDPOINT = "https://oidc.endpoint.com/authorize"
    settings.OIDC_RP_CLIENT_ID = "client_id"
    settings.OIDC_RP_CLIENT_SECRET = "client_secret"
    settings.OIDC_RP_SCOPES = "openid email"
    settings.OIDC_USE_NONCE = True
    settings.OIDC_VERIFY_SSL = True
    settings.OIDC_TOKEN_USE_BASIC_AUTH = False
    settings.OIDC_STORE_ACCESS_TOKEN = True
    settings.OIDC_STORE_REFRESH_TOKEN = True
    settings.OIDC_STORE_REFRESH_TOKEN_KEY = Fernet.generate_key()
    settings.OIDC_TOKEN_EXPIRATION = 100

    request = rf.get("/some-url")
    request.user = UserFactory()
    request.session = {}
    request.session["oidc_access_token"] = "old-access-token"
    store_oidc_refresh_token(request.session, "old-refresh_token")

    now = time.time()
    expiration = now - settings.OIDC_TOKEN_EXPIRATION
    request.session["oidc_token_expiration"] = expiration

    get_response = MagicMock()
    refresh_middleware = OIDCRefreshSessionMiddleware(get_response)

    responses.add(
        responses.POST,
        re.compile(settings.OIDC_OP_TOKEN_ENDPOINT),
        json={
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
        },
        status=200,
    )

    # pylint: disable=assignment-from-no-return
    response = refresh_middleware.process_request(request)

    assert response is None
    assert request.session["oidc_access_token"] == "new-access-token"
    assert request.session["oidc_id_token"] is None
    assert (
        request.session["oidc_token_expiration"]
        > expiration + settings.OIDC_TOKEN_EXPIRATION
    )
    assert get_oidc_refresh_token(request.session) == "new-refresh-token"


def test_access_token_when_expired(rf, settings):
    """
    Test if the middleware doesn't perform a token refresh if token not expired
    """

    settings.OIDC_OP_TOKEN_ENDPOINT = "http://oidc.endpoint.test/token"
    settings.OIDC_OP_AUTHORIZATION_ENDPOINT = "https://oidc.endpoint.com/authorize"
    settings.OIDC_RP_CLIENT_ID = "client_id"
    settings.OIDC_RP_CLIENT_SECRET = "client_secret"
    settings.OIDC_RP_SCOPES = "openid email"
    settings.OIDC_USE_NONCE = True
    settings.OIDC_VERIFY_SSL = True
    settings.OIDC_TOKEN_USE_BASIC_AUTH = False
    settings.OIDC_STORE_ACCESS_TOKEN = True
    settings.OIDC_STORE_REFRESH_TOKEN = True
    settings.OIDC_STORE_REFRESH_TOKEN_KEY = Fernet.generate_key()
    settings.OIDC_TOKEN_EXPIRATION = 100

    request = rf.get("/some-url")
    request.user = UserFactory()
    request.session = {}
    request.session["oidc_access_token"] = "access-token"
    store_oidc_refresh_token(request.session, "refresh_token")

    expiration = time.time() + 120
    request.session["oidc_token_expiration"] = expiration

    get_response = MagicMock()
    refresh_middleware = OIDCRefreshSessionMiddleware(get_response)

    # pylint: disable=assignment-from-no-return
    response = refresh_middleware.process_request(request)

    assert response is None
    assert request.session["oidc_token_expiration"] == expiration
