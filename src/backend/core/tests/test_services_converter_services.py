"""Test converter services."""

from unittest.mock import MagicMock, patch

import pytest
import requests

from core.services.converter_services import (
    ServiceUnavailableError,
    ValidationError,
    YdocConverter,
)


def test_auth_header(settings):
    """Test authentication header generation."""
    settings.Y_PROVIDER_API_KEY = "test-key"
    converter = YdocConverter()
    assert converter.auth_header == "test-key"


def test_convert_markdown_empty_text():
    """Should raise ValidationError when text is empty."""
    converter = YdocConverter()
    with pytest.raises(ValidationError, match="Input text cannot be empty"):
        converter.convert_markdown("")


@patch("requests.post")
def test_convert_markdown_service_unavailable(mock_post):
    """Should raise ServiceUnavailableError when service is unavailable."""
    converter = YdocConverter()

    mock_post.side_effect = requests.RequestException("Connection error")

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to conversion service",
    ):
        converter.convert_markdown("test text")


@patch("requests.post")
def test_convert_markdown_http_error(mock_post):
    """Should raise ServiceUnavailableError when HTTP error occurs."""
    converter = YdocConverter()

    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = requests.HTTPError("HTTP Error")
    mock_post.return_value = mock_response

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to conversion service",
    ):
        converter.convert_markdown("test text")


@patch("requests.post")
def test_convert_markdown_full_integration(mock_post, settings):
    """Test full integration with all settings."""

    settings.Y_PROVIDER_API_BASE_URL = "http://test.com/"
    settings.Y_PROVIDER_API_KEY = "test-key"
    settings.CONVERSION_API_ENDPOINT = "conversion-endpoint"
    settings.CONVERSION_API_TIMEOUT = 5
    settings.CONVERSION_API_CONTENT_FIELD = "content"

    converter = YdocConverter()

    expected_content = b"converted content"
    mock_response = MagicMock()
    mock_response.content = expected_content
    mock_post.return_value = mock_response

    result = converter.convert_markdown("test markdown")

    assert result == expected_content
    mock_post.assert_called_once_with(
        "http://test.com/conversion-endpoint/",
        data="test markdown",
        headers={
            "Authorization": "test-key",
            "Content-Type": "text/markdown",
        },
        timeout=5,
        verify=False,
    )


@patch("requests.post")
def test_convert_markdown_timeout(mock_post):
    """Should raise ServiceUnavailableError when request times out."""
    converter = YdocConverter()

    mock_post.side_effect = requests.Timeout("Request timed out")

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to conversion service",
    ):
        converter.convert_markdown("test text")


def test_convert_markdown_none_input():
    """Should raise ValidationError when input is None."""
    converter = YdocConverter()

    with pytest.raises(ValidationError, match="Input text cannot be empty"):
        converter.convert_markdown(None)
