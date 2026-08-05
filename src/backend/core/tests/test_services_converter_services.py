"""Test y-provider services."""

from base64 import b64decode
from unittest.mock import MagicMock, patch

import jwt
import pytest
import requests

from core.services import mime_types
from core.services.converter_services import (
    ServiceUnavailableError,
    ValidationError,
    YdocConverter,
)
from core.services.jwt_services import Audiences
from core.tests.utils.jwt_helper import generate_key_pair

# Generating an RSA key is expensive, do it once for the whole module
PRIVATE_KEY, PUBLIC_KEY = generate_key_pair()


@pytest.fixture(autouse=True)
def jwt_settings(settings):
    """Setup valid settings for the JWT service used to sign the auth header."""
    settings.JWT_PRIVATE_KEY = PRIVATE_KEY
    settings.JWT_TOKEN_LIFETIME = 3600


def test_auth_header():
    """The auth header carries an admin JWT scoped to the y-converter audience."""
    converter = YdocConverter()

    scheme, token = converter.auth_header.split(" ")

    assert scheme == "Bearer"
    payload = jwt.decode(
        token, PUBLIC_KEY, algorithms=["RS256"], audience=Audiences.Y_CONVERTER
    )
    assert payload["admin"] is True
    assert payload["aud"] == Audiences.Y_CONVERTER


def test_convert_empty_text():
    """Should raise ValidationError when data is empty."""
    converter = YdocConverter()
    with pytest.raises(ValidationError, match="Input data cannot be empty"):
        converter.convert("")


@patch("requests.post")
def test_convert_service_unavailable(mock_post):
    """Should raise ServiceUnavailableError when service is unavailable."""
    converter = YdocConverter()

    mock_post.side_effect = requests.RequestException("Connection error")

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to YDoc conversion service",
    ):
        converter.convert("test text")


@patch("requests.post")
def test_convert_http_error(mock_post):
    """Should raise ServiceUnavailableError when HTTP error occurs."""
    converter = YdocConverter()

    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = requests.HTTPError("HTTP Error")
    mock_post.return_value = mock_response

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to YDoc conversion service",
    ):
        converter.convert("test text")


@patch("requests.post")
def test_convert_full_integration(mock_post, settings):
    """Test full integration with all settings."""

    settings.Y_PROVIDER_API_BASE_URL = "http://test.com/"
    settings.CONVERSION_API_ENDPOINT = "conversion-endpoint"
    settings.CONVERSION_API_TIMEOUT = 5
    settings.CONVERSION_API_CONTENT_FIELD = "content"

    converter = YdocConverter()
    auth_header = converter.auth_header

    expected_content = b"converted content"
    mock_response = MagicMock()
    mock_response.content = expected_content
    mock_post.return_value = mock_response

    result = converter.convert("test markdown")

    assert b64decode(result) == expected_content

    mock_post.assert_called_once_with(
        "http://test.com/conversion-endpoint/",
        data="test markdown",
        headers={
            "Authorization": auth_header,
            "Content-Type": mime_types.MARKDOWN,
            "Accept": mime_types.YJS,
        },
        timeout=5,
        verify=False,
    )


@patch("requests.post")
def test_convert_full_integration_with_specific_headers(mock_post, settings):
    """Test successful conversion with specific content type and accept headers."""
    settings.Y_PROVIDER_API_BASE_URL = "http://test.com/"
    settings.CONVERSION_API_ENDPOINT = "conversion-endpoint"
    settings.CONVERSION_API_TIMEOUT = 5
    settings.CONVERSION_API_SECURE = False

    converter = YdocConverter()
    auth_header = converter.auth_header

    expected_response = "# Test Document\n\nThis is test content."
    mock_response = MagicMock()
    mock_response.text = expected_response
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    result = converter.convert(b"test_content", mime_types.YJS, mime_types.MARKDOWN)

    assert result == expected_response
    mock_post.assert_called_once_with(
        "http://test.com/conversion-endpoint/",
        data=b"test_content",
        headers={
            "Authorization": auth_header,
            "Content-Type": mime_types.YJS,
            "Accept": mime_types.MARKDOWN,
        },
        timeout=5,
        verify=False,
    )


@patch("requests.post")
def test_convert_timeout(mock_post):
    """Should raise ServiceUnavailableError when request times out."""
    converter = YdocConverter()

    mock_post.side_effect = requests.Timeout("Request timed out")

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to YDoc conversion service",
    ):
        converter.convert("test text")


def test_convert_none_input():
    """Should raise ValidationError when input is None."""
    converter = YdocConverter()

    with pytest.raises(ValidationError, match="Input data cannot be empty"):
        converter.convert(None)
