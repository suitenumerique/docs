"""Test yhub services."""

from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser

import jwt
import pytest
import requests

from core.factories import UserFactory
from core.services.yhub_services import (
    APIError,
    ConfigurationError,
    ServiceUnavailableError,
    YHubService,
)
from core.tests.utils.jwt_helper import generate_key_pair

# Generating an RSA key is expensive, do it once for the whole module
PRIVATE_KEY, PUBLIC_KEY = generate_key_pair()


@pytest.fixture(autouse=True)
def yhub_settings(settings):
    """Setup valid settings for the yhub service and the JWT service it signs with."""
    settings.YHUB_API_BASE_URL = "http://yhub:3002"
    settings.YHUB_ORG = "docs"
    settings.YHUB_API_TIMEOUT = 30
    settings.JWT_PRIVATE_KEY = PRIVATE_KEY
    settings.JWT_TOKEN_LIFETIME = 3600


def test_base_url_required(settings):
    """Should raise ConfigurationError when the base url is not configured."""
    settings.YHUB_API_BASE_URL = None
    service = YHubService()

    with pytest.raises(ConfigurationError, match="YHUB_API_BASE_URL"):
        _ = service.base_url


def test_base_url_strips_trailing_slash(settings):
    """The trailing slash of the base url should not leak into the urls we build."""
    settings.YHUB_API_BASE_URL = "http://yhub:3002/"

    assert YHubService().base_url == "http://yhub:3002"


def test_build_url():
    """A document scoped url should be mounted under the api prefix of yhub."""
    url = YHubService().build_url("ydoc", "8c1c8c4d-4b02-4b0f-a0e9-e00cbd1a9a2f")

    assert url == (
        "http://yhub:3002/collaboration/ydoc/v1/docs/"
        "8c1c8c4d-4b02-4b0f-a0e9-e00cbd1a9a2f"
    )


def test_auth_header():
    """The auth header should carry an admin JWT signed with the configured key."""
    scheme, token = YHubService().auth_header.split(" ")

    assert scheme == "Bearer"
    payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    assert payload["admin"] is True
    assert "sub" not in payload


def test_auth_header_with_user():
    """The token should name the user a call is made on behalf of as its subject."""
    user = UserFactory.build()

    _scheme, token = YHubService(user=user).auth_header.split(" ")

    payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    assert payload["sub"] == str(user.pk)
    # naming a subject should not restrict what the call can do
    assert payload["admin"] is True


def test_auth_header_with_anonymous_user():
    """An anonymous user is no subject, the token should not name one."""
    _scheme, token = YHubService(user=AnonymousUser()).auth_header.split(" ")

    payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    assert "sub" not in payload
    assert payload["admin"] is True


@patch("requests.request")
def test_request(mock_request):
    """Should send an authenticated request to the yhub API."""
    mock_request.return_value.ok = True
    service = YHubService()

    response = service.request(
        "get", service.build_url("ydoc", "doc-id"), params={"gc": "false"}
    )

    assert response is mock_request.return_value
    args, kwargs = mock_request.call_args
    assert args == ("get", "http://yhub:3002/collaboration/ydoc/v1/docs/doc-id")
    assert kwargs["params"] == {"gc": "false"}
    assert kwargs["timeout"] == 30
    assert kwargs["headers"]["Authorization"].startswith("Bearer ")


@patch("requests.request")
def test_request_service_unavailable(mock_request):
    """Should raise ServiceUnavailableError when yhub cannot be reached."""
    mock_request.side_effect = requests.RequestException("Connection error")

    with pytest.raises(
        ServiceUnavailableError, match="Failed to connect to the yhub service"
    ):
        YHubService().request(
            "get", "http://yhub:3002/collaboration/ydoc/v1/docs/doc-id"
        )


@patch("requests.request")
def test_request_error_status(mock_request):
    """Should raise APIError, carrying the status, when yhub answers an error."""
    mock_request.return_value.ok = False
    mock_request.return_value.status_code = 403
    mock_request.return_value.text = "Forbidden"

    with pytest.raises(APIError, match="The yhub API answered 403") as excinfo:
        YHubService().request(
            "get", "http://yhub:3002/collaboration/ydoc/v1/docs/doc-id"
        )

    assert excinfo.value.status_code == 403
