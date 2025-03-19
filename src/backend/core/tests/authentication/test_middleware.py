"""Tests for the RefreshOIDCAccessToken middleware."""

import time
from unittest.mock import MagicMock

from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.http import HttpResponse, JsonResponse
from django.test import RequestFactory

import pytest
import requests.exceptions
import responses
from cryptography.fernet import Fernet

from core import factories
from core.authentication.backends import (
    get_cipher_suite,
    get_oidc_refresh_token,
    store_oidc_refresh_token,
)
from core.authentication.middleware import RefreshOIDCAccessToken

pytestmark = pytest.mark.django_db


@pytest.fixture(name="oidc_settings")
def fixture_oidc_settings(settings):
    """Fixture to configure OIDC settings for the tests."""
    settings.OIDC_OP_TOKEN_ENDPOINT = "https://auth.example.com/token"
    settings.OIDC_OP_AUTHORIZATION_ENDPOINT = "https://auth.example.com/authorize"
    settings.OIDC_RP_CLIENT_ID = "client_id"
    settings.OIDC_RP_CLIENT_SECRET = "client_secret"
    settings.OIDC_AUTHENTICATION_CALLBACK_URL = "oidc_authentication_callback"
    settings.OIDC_RP_SCOPES = "openid email"
    settings.OIDC_USE_NONCE = True
    settings.OIDC_STATE_SIZE = 32
    settings.OIDC_NONCE_SIZE = 32
    settings.OIDC_VERIFY_SSL = True
    settings.OIDC_TOKEN_USE_BASIC_AUTH = False
    settings.OIDC_STORE_ACCESS_TOKEN = True
    settings.OIDC_STORE_REFRESH_TOKEN = True
    settings.OIDC_STORE_REFRESH_TOKEN_KEY = Fernet.generate_key()

    get_cipher_suite.cache_clear()

    yield settings

    get_cipher_suite.cache_clear()


def test_anonymous_user(oidc_settings):  # pylint: disable=unused-argument
    """
    When the user is not authenticated, this
    is not the purpose of the middleware to manage anything.
    """
    request = RequestFactory().get("/test")
    request.user = AnonymousUser()

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)

    middleware = RefreshOIDCAccessToken(get_response)
    response = middleware.process_request(request)
    assert response is None


def test_no_refresh_token(oidc_settings):  # pylint: disable=unused-argument
    """
    When the session does not contain a refresh token,
    the middleware should return a 401 response containing
    the URL to authenticate again.
    """
    user = factories.UserFactory()

    request = RequestFactory().get("/test")
    request.user = user

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)

    request.session["oidc_access_token"] = ("expired_token",)
    request.session["oidc_token_expiration"] = time.time() - 100

    middleware = RefreshOIDCAccessToken(get_response)
    response = middleware.process_request(request)
    assert isinstance(response, JsonResponse)
    assert response.status_code == 401
    assert response.has_header("refresh_url")
    assert response["refresh_url"].startswith("https://auth.example.com/authorize")


def test_basic_auth_disabled(oidc_settings):  # pylint: disable=unused-argument
    """We don't support OIDC_TOKEN_USE_BASIC_AUTH"""
    oidc_settings.OIDC_TOKEN_USE_BASIC_AUTH = True

    user = factories.UserFactory()

    request = RequestFactory().get("/test")
    request.user = user

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)

    request.session["oidc_access_token"] = "old_token"
    store_oidc_refresh_token(request.session, "refresh_token")
    request.session["oidc_token_expiration"] = time.time() - 100
    request.session.save()

    middleware = RefreshOIDCAccessToken(get_response)
    with pytest.raises(RuntimeError) as excinfo:
        middleware.process_request(request)

    assert str(excinfo.value) == "OIDC_TOKEN_USE_BASIC_AUTH is not supported"


@responses.activate
def test_successful_token_refresh(oidc_settings):  # pylint: disable=unused-argument
    """Test that the middleware successfully refreshes the token."""
    user = factories.UserFactory()

    request = RequestFactory().get("/test")
    request.user = user

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)

    request.session["oidc_access_token"] = "old_token"
    store_oidc_refresh_token(request.session, "refresh_token")
    request.session["oidc_token_expiration"] = time.time() - 100
    request.session.save()

    responses.add(
        responses.POST,
        "https://auth.example.com/token",
        json={"access_token": "new_token", "refresh_token": "new_refresh_token"},
        status=200,
    )

    middleware = RefreshOIDCAccessToken(get_response)
    response = middleware.process_request(request)
    request.session.save()

    assert response is None
    assert request.session["oidc_access_token"] == "new_token"
    assert get_oidc_refresh_token(request.session) == "new_refresh_token"


def test_non_expired_token(oidc_settings):  # pylint: disable=unused-argument
    """Test that the middleware does nothing when the token is not expired."""
    user = factories.UserFactory()

    request = RequestFactory().get("/test")
    request.user = user

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)
    request.session["oidc_access_token"] = ("valid_token",)
    request.session["oidc_token_expiration"] = time.time() + 3600
    request.session.save()

    middleware = RefreshOIDCAccessToken(get_response)

    response = middleware.process_request(request)
    assert response is None


@responses.activate
def test_refresh_token_request_timeout(oidc_settings):  # pylint: disable=unused-argument
    """Test that the middleware returns a 401 response when the token refresh request times out."""
    user = factories.UserFactory()
    request = RequestFactory().get("/test")
    request.user = user

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)
    request.session["oidc_access_token"] = "old_token"
    store_oidc_refresh_token(request.session, "refresh_token")
    request.session["oidc_token_expiration"] = time.time() - 100
    request.session.save()

    responses.add(
        responses.POST,
        "https://auth.example.com/token",
        body=requests.exceptions.Timeout("timeout"),
    )

    middleware = RefreshOIDCAccessToken(get_response)
    response = middleware.process_request(request)
    assert isinstance(response, HttpResponse)
    assert response.status_code == 401
    assert not response.has_header("refresh_url")


@responses.activate
def test_refresh_token_request_error_400(oidc_settings):  # pylint: disable=unused-argument
    """
    Test that the middleware returns a 401 response when the token
    refresh request returns a 400 error.
    """
    user = factories.UserFactory()
    request = RequestFactory().get("/test")
    request.user = user

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)
    request.session["oidc_access_token"] = "old_token"
    store_oidc_refresh_token(request.session, "refresh_token")
    request.session["oidc_token_expiration"] = time.time() - 100
    request.session.save()

    responses.add(
        responses.POST,
        "https://auth.example.com/token",
        json={"error": "invalid_grant"},
        status=400,
    )

    middleware = RefreshOIDCAccessToken(get_response)
    response = middleware.process_request(request)
    assert isinstance(response, HttpResponse)
    assert response.status_code == 401
    assert response.has_header("refresh_url")
    assert response["refresh_url"].startswith("https://auth.example.com/authorize")


@responses.activate
def test_refresh_token_request_error(oidc_settings):  # pylint: disable=unused-argument
    """
    Test that the middleware returns a 401 response when
    the token refresh request returns a 404 error.
    """
    user = factories.UserFactory()
    request = RequestFactory().get("/test")
    request.user = user

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)
    request.session["oidc_access_token"] = "old_token"
    store_oidc_refresh_token(request.session, "refresh_token")
    request.session["oidc_token_expiration"] = time.time() - 100
    request.session.save()

    responses.add(
        responses.POST,
        "https://auth.example.com/token",
        json={"error": "invalid_grant"},
        status=404,
    )

    middleware = RefreshOIDCAccessToken(get_response)
    response = middleware.process_request(request)
    assert isinstance(response, HttpResponse)
    assert response.status_code == 401
    assert not response.has_header("refresh_url")


@responses.activate
def test_refresh_token_request_malformed_json_error(oidc_settings):  # pylint: disable=unused-argument
    """
    Test that the middleware returns a 401 response
    when the token refresh request returns malformed JSON.
    """
    user = factories.UserFactory()
    request = RequestFactory().get("/test")
    request.user = user

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)
    request.session["oidc_access_token"] = "old_token"
    store_oidc_refresh_token(request.session, "refresh_token")
    request.session["oidc_token_expiration"] = time.time() - 100
    request.session.save()

    responses.add(
        responses.POST,
        "https://auth.example.com/token",
        body="malformed json",
        status=200,
    )

    middleware = RefreshOIDCAccessToken(get_response)
    response = middleware.process_request(request)
    assert isinstance(response, HttpResponse)
    assert response.status_code == 401
    assert not response.has_header("refresh_url")


@responses.activate
def test_refresh_token_request_exception(oidc_settings):  # pylint: disable=unused-argument
    """
    Test that the middleware returns a 401 response
    when the token refresh request raises an exception.
    """
    user = factories.UserFactory()
    request = RequestFactory().get("/test")
    request.user = user

    get_response = MagicMock()
    session_middleware = SessionMiddleware(get_response)
    session_middleware.process_request(request)
    request.session["oidc_access_token"] = "old_token"
    store_oidc_refresh_token(request.session, "refresh_token")
    request.session["oidc_token_expiration"] = time.time() - 100
    request.session.save()

    responses.add(
        responses.POST,
        "https://auth.example.com/token",
        body={"error": "invalid_grant"},  # invalid format dict
        status=200,
    )

    middleware = RefreshOIDCAccessToken(get_response)
    response = middleware.process_request(request)
    assert isinstance(response, HttpResponse)
    assert response.status_code == 401
    assert not response.has_header("refresh_url")
