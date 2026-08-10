"""Test yhub services."""

from base64 import b64encode
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth.models import AnonymousUser

import jwt
import pytest
import requests

from core import models
from core.factories import UserFactory
from core.services.jwt_services import Audiences
from core.services.yhub_services import (
    APIError,
    ConfigurationError,
    ServiceUnavailableError,
    YHubService,
)
from core.tests.utils.jwt_helper import generate_key_pair

# Generating an RSA key is expensive, do it once for the whole module
PRIVATE_KEY, PUBLIC_KEY = generate_key_pair()

# the service only ever reads the id of the document, no need to save one
DOCUMENT = models.Document(id=uuid4())


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
    url = YHubService().build_url("ydoc", DOCUMENT)

    assert url == f"http://yhub:3002/collaboration/ydoc/v1/docs/{DOCUMENT.id!s}"


def test_jwks_url():
    """The keys validating what yhub signs should be read from yhub itself."""
    service = YHubService()

    assert service.jwks_url == "http://yhub:3002/collaboration/jwks/v1"
    assert service.jwks.url == service.jwks_url


def test_auth_header():
    """The auth header should carry an admin JWT signed with the configured key."""
    scheme, token = YHubService().auth_header.split(" ")

    assert scheme == "Bearer"
    payload = jwt.decode(
        token, PUBLIC_KEY, algorithms=["RS256"], audience=Audiences.YHUB
    )
    assert payload["admin"] is True
    assert payload["aud"] == Audiences.YHUB
    assert "sub" not in payload


def test_auth_header_with_user():
    """The token should name the user a call is made on behalf of as its subject."""
    user = UserFactory.build()

    _scheme, token = YHubService(user=user).auth_header.split(" ")

    payload = jwt.decode(
        token, PUBLIC_KEY, algorithms=["RS256"], audience=Audiences.YHUB
    )
    assert payload["sub"] == str(user.pk)
    # naming a subject should not restrict what the call can do
    assert payload["admin"] is True
    assert payload["aud"] == Audiences.YHUB


def test_auth_header_with_anonymous_user():
    """An anonymous user is no subject, the token should not name one."""
    _scheme, token = YHubService(user=AnonymousUser()).auth_header.split(" ")

    payload = jwt.decode(
        token, PUBLIC_KEY, algorithms=["RS256"], audience=Audiences.YHUB
    )
    assert "sub" not in payload
    assert payload["admin"] is True
    assert payload["aud"] == Audiences.YHUB


@patch("requests.request")
def test_request(mock_request):
    """Should send an authenticated request to the yhub API."""
    mock_request.return_value.ok = True
    service = YHubService()

    response = service.request(
        "post", service.build_url("ydoc", DOCUMENT), data=b"body"
    )

    assert response is mock_request.return_value
    args, kwargs = mock_request.call_args
    assert args == (
        "post",
        f"http://yhub:3002/collaboration/ydoc/v1/docs/{DOCUMENT.id!s}",
    )
    assert kwargs["data"] == b"body"
    assert kwargs["timeout"] == 30
    assert kwargs["headers"]["Authorization"].startswith("Bearer ")
    # asked of every endpoint: yhub answers its lib0 encoding otherwise
    assert kwargs["headers"]["Accept"] == "application/json"


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


@patch("requests.request")
def test_create_ydoc(mock_request):
    """Should post the raw update, unencoded, to the create-ydoc endpoint."""
    mock_request.return_value.ok = True
    update = b"\x01\x02\x03\x04"

    response = YHubService().create_ydoc(DOCUMENT, update)

    assert response is mock_request.return_value
    args, kwargs = mock_request.call_args
    assert args == (
        "post",
        f"http://yhub:3002/collaboration/create-ydoc/v1/docs/{DOCUMENT.id!s}",
    )
    assert kwargs["data"] == update
    # nobody to attribute the content to
    assert "X-User-Id" not in kwargs["headers"]


@patch("requests.request")
def test_create_ydoc_attributes_the_content_to_the_user(mock_request):
    """The content should be attributed to the user the service is bound to."""
    mock_request.return_value.ok = True
    user = UserFactory.build()

    YHubService(user=user).create_ydoc(DOCUMENT, b"\x01\x02\x03\x04")

    _args, kwargs = mock_request.call_args
    assert kwargs["headers"]["X-User-Id"] == str(user.pk)


@patch("requests.request")
def test_create_ydoc_already_exists(mock_request):
    """The strict create of yhub should surface as an APIError carrying the 409."""
    mock_request.return_value.ok = False
    mock_request.return_value.status_code = 409
    mock_request.return_value.text = "Document already exists"

    with pytest.raises(APIError) as excinfo:
        YHubService().create_ydoc(DOCUMENT, b"\x01\x02\x03\x04")

    assert excinfo.value.status_code == 409


@patch("requests.request")
def test_migrate(mock_request):
    """Should ask yhub to replay the legacy history, and answer what it did."""
    mock_request.return_value.ok = True
    mock_request.return_value.json.return_value = {
        "status": "ok",
        "message": "Migration completed",
        "migrated": True,
        "versions": 12,
        "applied": 9,
        "durationMs": 1234,
    }

    result = YHubService().migrate(DOCUMENT)

    assert result["status"] == "ok"
    assert result["applied"] == 9
    args, kwargs = mock_request.call_args
    assert args == (
        "post",
        f"http://yhub:3002/collaboration/migrate/v1/docs/{DOCUMENT.id!s}",
    )
    # reading every version of a document takes longer than any other call
    assert kwargs["timeout"] == 600


@patch("requests.request")
def test_migrate_forced(mock_request):
    """Forcing a document that is already migrated should be asked for explicitly."""
    mock_request.return_value.ok = True
    mock_request.return_value.json.return_value = {"status": "ok"}

    YHubService().migrate(DOCUMENT, force=True)

    args, _kwargs = mock_request.call_args
    assert args[1].endswith("?force=true")


@patch("requests.request")
def test_reset_connections(mock_request):
    """Should ask yhub to re-check every connection of the document."""
    mock_request.return_value.ok = True

    response = YHubService().reset_connections(DOCUMENT)

    assert response is mock_request.return_value
    args, kwargs = mock_request.call_args
    assert args == (
        "post",
        f"http://yhub:3002/collaboration/reset-connections/v1/docs/{DOCUMENT.id!s}",
    )
    # no user named: every connection of the document is re-checked
    assert "X-User-Id" not in kwargs["headers"]


@patch("requests.request")
def test_reset_connections_of_a_single_user(mock_request):
    """Naming a user should restrict the re-check to their own connections."""
    mock_request.return_value.ok = True
    user = UserFactory.build()

    # the user whose access changed, not the one making the call
    YHubService(user=UserFactory.build()).reset_connections(DOCUMENT, user.pk)

    _args, kwargs = mock_request.call_args
    assert kwargs["headers"]["X-User-Id"] == str(user.pk)


@patch("requests.request")
def test_get_ydoc(mock_request):
    """Should return the raw update the collaboration server holds."""
    mock_request.return_value.ok = True
    mock_request.return_value.json.return_value = {
        "doc": b64encode(b"\x01\x02raw yjs update").decode()
    }

    update = YHubService().get_ydoc(DOCUMENT)

    assert update == b"\x01\x02raw yjs update"
    args, kwargs = mock_request.call_args
    # the built-in endpoint, which answers the update base64 encoded in json
    assert args == (
        "get",
        f"http://yhub:3002/collaboration/ydoc/v1/docs/{DOCUMENT.id!s}",
    )
    assert kwargs["headers"]["Accept"] == "application/json"


@patch("requests.request")
def test_get_ydoc_without_content(mock_request):
    """A document the collaboration server holds no content for should return None."""
    mock_request.return_value.ok = True
    # a room with no content answers the encoding of an empty document
    mock_request.return_value.json.return_value = {
        "doc": b64encode(b"\x00\x00").decode()
    }

    assert YHubService().get_ydoc(DOCUMENT) is None


@patch("requests.request")
def test_get_ydoc_unreadable_answer(mock_request):
    """An answer we cannot read a document out of should raise, never look empty."""
    mock_request.return_value.ok = True
    mock_request.return_value.json.return_value = {"unexpected": "payload"}

    with pytest.raises(APIError):
        YHubService().get_ydoc(DOCUMENT)


@patch("requests.request")
def test_request_error_reports_what_yhub_said(mock_request):
    """The message yhub puts in its json error should travel with the status."""
    mock_request.return_value.ok = False
    mock_request.return_value.status_code = 409
    mock_request.return_value.text = '{"error": "Document already exists"}'
    mock_request.return_value.json.return_value = {"error": "Document already exists"}

    with pytest.raises(APIError, match="Document already exists") as excinfo:
        YHubService().create_ydoc(DOCUMENT, b"\x01\x02update")

    assert excinfo.value.status_code == 409


@patch("requests.request")
def test_request_error_without_json_body(mock_request):
    """An error from something else on the way should be reported all the same."""
    mock_request.return_value.ok = False
    mock_request.return_value.status_code = 502
    mock_request.return_value.text = "<html>Bad Gateway</html>"
    mock_request.return_value.json.side_effect = ValueError("not json")

    with pytest.raises(APIError, match="answered 502") as excinfo:
        YHubService().get_ydoc(DOCUMENT)

    assert excinfo.value.status_code == 502
