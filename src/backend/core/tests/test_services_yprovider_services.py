"""Test y-provider services."""

import json
from base64 import b64decode
from unittest.mock import MagicMock, patch

import pytest
import requests

from core.services.yprovider_services import (
    ServiceUnavailableError,
    ValidationError,
    YProviderAPI,
)


def test_auth_header(settings):
    """Test authentication header generation."""
    settings.Y_PROVIDER_API_KEY = "test-key"
    converter = YProviderAPI()
    assert converter.auth_header == "Bearer test-key"


def test_convert_empty_text():
    """Should raise ValidationError when text is empty."""
    converter = YProviderAPI()
    with pytest.raises(ValidationError, match="Input text cannot be empty"):
        converter.convert("")


@patch("requests.post")
def test_convert_service_unavailable(mock_post):
    """Should raise ServiceUnavailableError when service is unavailable."""
    converter = YProviderAPI()

    mock_post.side_effect = requests.RequestException("Connection error")

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to backend service",
    ):
        converter.convert("test text")


@patch("requests.post")
def test_convert_http_error(mock_post):
    """Should raise ServiceUnavailableError when HTTP error occurs."""
    converter = YProviderAPI()

    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = requests.HTTPError("HTTP Error")
    mock_post.return_value = mock_response

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to backend service",
    ):
        converter.convert("test text")


@patch("requests.post")
def test_convert_full_integration(mock_post, settings):
    """Test full integration with all settings."""

    settings.Y_PROVIDER_API_BASE_URL = "http://test.com/"
    settings.Y_PROVIDER_API_KEY = "test-key"
    settings.CONVERSION_API_ENDPOINT = "conversion-endpoint"
    settings.CONVERSION_API_TIMEOUT = 5
    settings.CONVERSION_API_CONTENT_FIELD = "content"

    converter = YProviderAPI()

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
            "Authorization": "Bearer test-key",
            "Content-Type": "text/markdown",
        },
        timeout=5,
        verify=False,
    )


@patch("requests.post")
def test_convert_timeout(mock_post):
    """Should raise ServiceUnavailableError when request times out."""
    converter = YProviderAPI()

    mock_post.side_effect = requests.Timeout("Request timed out")

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to backend service",
    ):
        converter.convert("test text")


def test_convert_none_input():
    """Should raise ValidationError when input is None."""
    converter = YProviderAPI()

    with pytest.raises(ValidationError, match="Input text cannot be empty"):
        converter.convert(None)


def test_content_empty_content():
    """Should raise ValidationError when content is empty."""
    converter = YProviderAPI()
    with pytest.raises(ValidationError, match="Input content cannot be empty"):
        converter.content("", "markdown")


@patch("requests.post")
def test_content_service_unavailable(mock_post):
    """Should raise ServiceUnavailableError when service is unavailable."""
    converter = YProviderAPI()

    mock_post.side_effect = requests.RequestException("Connection error")

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to backend service",
    ):
        converter.content("test_content", "markdown")


@patch("requests.post")
def test_content_success(mock_post, settings):
    """Test successful content fetch."""
    settings.Y_PROVIDER_API_BASE_URL = "http://test.com/api/"
    settings.Y_PROVIDER_API_KEY = "test-key"
    settings.CONVERSION_API_TIMEOUT = 5
    settings.CONVERSION_API_SECURE = False

    converter = YProviderAPI()

    expected_response = {
        "content": "# Test Document\n\nThis is test content.",
        "format": "markdown",
    }
    mock_response = MagicMock()
    mock_response.json.return_value = expected_response
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    result = converter.content("test_content", "markdown")

    assert result == expected_response
    mock_post.assert_called_once_with(
        "http://test.com/api/content/",
        data=json.dumps({"content": "test_content", "format": "markdown"}),
        headers={
            "Authorization": "Bearer test-key",
            "Content-Type": "application/json",
        },
        timeout=5,
        verify=False,
    )
