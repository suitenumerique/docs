"""Test DocSpec converter services."""

from unittest.mock import MagicMock, patch

import pytest
import requests

from core.services import mime_types
from core.services.converter_services import (
    DocSpecConverter,
    ServiceUnavailableError,
    ValidationError,
)


def test_docspec_convert_empty_data():
    """Should raise ValidationError when data is empty."""
    converter = DocSpecConverter()
    with pytest.raises(ValidationError, match="Input data cannot be empty"):
        converter.convert("", mime_types.DOCX, mime_types.BLOCKNOTE)


def test_docspec_convert_none_input():
    """Should raise ValidationError when input is None."""
    converter = DocSpecConverter()
    with pytest.raises(ValidationError, match="Input data cannot be empty"):
        converter.convert(None, mime_types.DOCX, mime_types.BLOCKNOTE)


def test_docspec_convert_unsupported_content_type():
    """Should raise ValidationError when content type is not DOCX."""
    converter = DocSpecConverter()
    with pytest.raises(
        ValidationError, match="Conversion from text/plain to .* is not supported"
    ):
        converter.convert(b"test data", "text/plain", mime_types.BLOCKNOTE)


def test_docspec_convert_unsupported_accept():
    """Should raise ValidationError when accept type is not BLOCKNOTE."""
    converter = DocSpecConverter()
    with pytest.raises(
        ValidationError,
        match=f"Conversion from {mime_types.DOCX} to {mime_types.YJS} is not supported",
    ):
        converter.convert(b"test data", mime_types.DOCX, mime_types.YJS)


@patch("requests.post")
def test_docspec_convert_service_unavailable(mock_post):
    """Should raise ServiceUnavailableError when service is unavailable."""
    converter = DocSpecConverter()
    mock_post.side_effect = requests.RequestException("Connection error")

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to DocSpec conversion service",
    ):
        converter.convert(b"test data", mime_types.DOCX, mime_types.BLOCKNOTE)


@patch("requests.post")
def test_docspec_convert_http_error(mock_post):
    """Should raise ServiceUnavailableError when HTTP error occurs."""
    converter = DocSpecConverter()
    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = requests.HTTPError("HTTP Error")
    mock_post.return_value = mock_response

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to DocSpec conversion service",
    ):
        converter.convert(b"test data", mime_types.DOCX, mime_types.BLOCKNOTE)


@patch("requests.post")
def test_docspec_convert_timeout(mock_post):
    """Should raise ServiceUnavailableError when request times out."""
    converter = DocSpecConverter()
    mock_post.side_effect = requests.Timeout("Request timed out")

    with pytest.raises(
        ServiceUnavailableError,
        match="Failed to connect to DocSpec conversion service",
    ):
        converter.convert(b"test data", mime_types.DOCX, mime_types.BLOCKNOTE)


@patch("requests.post")
def test_docspec_convert_success(mock_post, settings):
    """Test successful DOCX to BlockNote conversion."""
    settings.DOCSPEC_API_URL = "http://docspec.test/convert"
    settings.CONVERSION_API_TIMEOUT = 5
    settings.CONVERSION_API_SECURE = False

    converter = DocSpecConverter()

    expected_content = b'[{"type": "paragraph", "content": "test"}]'
    mock_response = MagicMock()
    mock_response.content = expected_content
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    docx_data = b"fake docx binary data"
    result = converter.convert(docx_data, mime_types.DOCX, mime_types.BLOCKNOTE)

    assert result == expected_content

    # Verify the request was made correctly
    mock_post.assert_called_once_with(
        "http://docspec.test/convert",
        headers={"Accept": mime_types.BLOCKNOTE},
        files={"file": ("document.docx", docx_data, mime_types.DOCX)},
        timeout=5,
        verify=False,
    )
