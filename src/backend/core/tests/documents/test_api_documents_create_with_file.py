"""
Tests for Documents API endpoint in impress's core app: create with file upload
"""

from base64 import b64decode, binascii
from io import BytesIO
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from core import factories
from core.models import Document
from core.services import mime_types
from core.services.converter_services import (
    ConversionError,
    ServiceUnavailableError,
)
from core.utils.analytics import PosthogEventName

pytestmark = pytest.mark.django_db


def test_api_documents_create_with_file_anonymous():
    """Anonymous users should not be allowed to create documents with file upload."""
    # Create a fake DOCX file
    file_content = b"fake docx content"
    file = BytesIO(file_content)
    file.name = "test_document.docx"

    response = APIClient().post(
        "/api/v1.0/documents/",
        {
            "file": file,
        },
        format="multipart",
    )

    assert response.status_code == 401
    assert not Document.objects.exists()


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_create_with_docx_file_success(mock_convert, settings):
    """
    Authenticated users should be able to create documents by uploading a DOCX file.
    The file should be converted to YJS format and the title should be set from filename.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = True

    # Mock the conversion
    converted_yjs = "base64encodedyjscontent"
    mock_convert.return_value = converted_yjs

    # Create a fake DOCX file
    file_content = b"fake docx content"
    file = BytesIO(file_content)
    file.name = "My Important Document.docx"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 201
    document = Document.objects.get()
    assert document.title == "My Important Document.docx"
    assert document.content == converted_yjs
    assert document.accesses.filter(role="owner", user=user).exists()

    # Verify the converter was called correctly
    mock_convert.assert_called_once_with(
        file_content,
        content_type=mime_types.DOCX,
        accept=mime_types.YJS,
    )

    # The successful conversion should be tracked in PostHog
    mock_capture.assert_any_call(
        PosthogEventName.DOC_IMPORTED,
        user,
        {"content_type": mime_types.DOCX},
    )
    mock_capture.assert_any_call(
        PosthogEventName.DOC_CREATED,
        user,
        {},
        document=document,
    )

    assert mock_capture.call_count == 2


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_create_with_docx_file_disabled(mock_convert, settings):
    """
    When conversion is not enabled, uploading a file should have no effect
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = False

    # Create a fake DOCX file
    file_content = b"fake docx content"
    file = BytesIO(file_content)
    file.name = "My Important Document.docx"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 400
    assert response.json() == {"file": ["file upload is not allowed"]}

    # Verify the converter was not called
    mock_convert.assert_not_called()

    # No event should be tracked since the upload is rejected
    mock_capture.assert_not_called()


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_create_with_markdown_file_success(mock_convert, settings):
    """
    Authenticated users should be able to create documents by uploading a Markdown file.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = True

    # Mock the conversion
    converted_yjs = "base64encodedyjscontent"
    mock_convert.return_value = converted_yjs

    # Create a fake Markdown file
    file_content = b"# Test Document\n\nThis is a test."
    file = BytesIO(file_content)
    file.name = "readme.md"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 201
    document = Document.objects.get()
    assert document.title == "readme.md"
    assert document.content == converted_yjs
    assert document.accesses.filter(role="owner", user=user).exists()

    # Verify the converter was called correctly
    mock_convert.assert_called_once_with(
        file_content,
        content_type=mime_types.MARKDOWN,
        accept=mime_types.YJS,
    )

    # The successful conversion should be tracked in PostHog
    mock_capture.assert_any_call(
        PosthogEventName.DOC_IMPORTED,
        user,
        {"content_type": mime_types.MARKDOWN},
    )
    mock_capture.assert_any_call(
        PosthogEventName.DOC_CREATED,
        user,
        {},
        document=document,
    )

    assert mock_capture.call_count == 2


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_create_with_file_and_explicit_title(mock_convert, settings):
    """
    When both file and title are provided, the filename should override the title.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = True

    # Mock the conversion
    converted_yjs = "base64encodedyjscontent"
    mock_convert.return_value = converted_yjs

    # Create a fake DOCX file
    file_content = b"fake docx content"
    file = BytesIO(file_content)
    file.name = "Uploaded Document.docx"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
                "title": "This should be overridden",
            },
            format="multipart",
        )

    assert response.status_code == 201
    document = Document.objects.get()
    # The filename should take precedence
    assert document.title == "Uploaded Document.docx"

    # The successful conversion should be tracked in PostHog
    mock_capture.assert_any_call(
        PosthogEventName.DOC_IMPORTED,
        user,
        {"content_type": mime_types.DOCX},
    )
    mock_capture.assert_any_call(
        PosthogEventName.DOC_CREATED,
        user,
        {},
        document=document,
    )

    assert mock_capture.call_count == 2


def test_api_documents_create_with_empty_file(settings):
    """
    Creating a document with an empty file should fail with a validation error.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = True

    # Create an empty file
    file = BytesIO(b"")
    file.name = "empty.docx"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 400
    assert response.json() == {"file": ["The submitted file is empty."]}
    assert not Document.objects.exists()

    mock_capture.assert_not_called()


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_create_with_file_conversion_error(mock_convert, settings):
    """
    When conversion fails, the API should return a 400 error with appropriate message.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = True

    # Mock the conversion to raise an error
    mock_convert.side_effect = ConversionError("Failed to convert document")

    # Create a fake DOCX file
    file_content = b"fake invalid docx content"
    file = BytesIO(file_content)
    file.name = "corrupted.docx"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 400
    assert response.json() == {"file": ["Could not convert file content"]}
    assert not Document.objects.exists()

    # No event should be tracked when the conversion fails
    mock_capture.assert_not_called()


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_create_with_file_service_unavailable(mock_convert, settings):
    """
    When the conversion service is unavailable, appropriate error should be returned.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = True

    # Mock the conversion to raise ServiceUnavailableError
    mock_convert.side_effect = ServiceUnavailableError(
        "Failed to connect to conversion service"
    )

    # Create a fake DOCX file
    file_content = b"fake docx content"
    file = BytesIO(file_content)
    file.name = "document.docx"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 400
    assert response.json() == {"file": ["Could not convert file content"]}
    assert not Document.objects.exists()

    # No event should be tracked when the conversion service is unavailable
    mock_capture.assert_not_called()


def test_api_documents_create_without_file_still_works():
    """
    Creating a document without a file should still work as before (backward compatibility).
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "title": "Regular document without file",
            },
            format="json",
        )

    assert response.status_code == 201
    document = Document.objects.get()
    assert document.title == "Regular document without file"
    assert document.content is None
    assert document.accesses.filter(role="owner", user=user).exists()

    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_CREATED,
        user,
        {},
        document=document,
    )


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_create_with_file_null_value(mock_convert, settings):
    """
    Passing file=null should be treated as no file upload.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = True

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "title": "Document with null file",
                "file": None,
            },
            format="json",
        )

    assert response.status_code == 201
    document = Document.objects.get()
    assert document.title == "Document with null file"
    # Converter should not have been called
    mock_convert.assert_not_called()
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_CREATED,
        user,
        {},
        document=document,
    )


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_create_with_file_preserves_content_format(
    mock_convert, settings
):
    """
    Verify that the converted content is stored correctly in the document.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = True

    # Mock the conversion with realistic base64-encoded YJS data
    converted_yjs = "AQMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICA="
    mock_convert.return_value = converted_yjs

    # Create a fake DOCX file
    file_content = b"fake docx with complex formatting"
    file = BytesIO(file_content)
    file.name = "complex_document.docx"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 201
    document = Document.objects.get()

    # Verify the content is stored as returned by the converter
    assert document.content == converted_yjs

    # The successful conversion should be tracked in PostHog
    mock_capture.assert_any_call(
        PosthogEventName.DOC_IMPORTED,
        user,
        {"content_type": mime_types.DOCX},
    )
    mock_capture.assert_any_call(
        PosthogEventName.DOC_CREATED,
        user,
        {},
        document=document,
    )

    assert mock_capture.call_count == 2

    # Verify it's valid base64 (can be decoded)
    try:
        b64decode(converted_yjs)
    except binascii.Error:
        pytest.fail("Content should be valid base64-encoded data")


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_create_with_file_unicode_filename(mock_convert, settings):
    """
    Test that Unicode characters in filenames are handled correctly.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    settings.CONVERSION_UPLOAD_ENABLED = True

    # Mock the conversion
    converted_yjs = "base64encodedyjscontent"
    mock_convert.return_value = converted_yjs

    # Create a file with Unicode characters in the name
    file_content = b"fake docx content"
    file = BytesIO(file_content)
    file.name = "文档-télécharger-документ.docx"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 201
    document = Document.objects.get()
    assert document.title == "文档-télécharger-документ.docx"

    # The successful conversion should be tracked in PostHog
    mock_capture.assert_any_call(
        PosthogEventName.DOC_IMPORTED,
        user,
        {"content_type": mime_types.DOCX},
    )
    mock_capture.assert_any_call(
        PosthogEventName.DOC_CREATED,
        user,
        {},
        document=document,
    )

    assert mock_capture.call_count == 2


def test_api_documents_create_with_file_max_size_exceeded(settings):
    """
    The uploaded file should not exceed the maximum size in settings.
    """
    settings.CONVERSION_FILE_MAX_SIZE = 1  # 1 byte for test
    settings.CONVERSION_UPLOAD_ENABLED = True

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    file = BytesIO(b"a" * (10))
    file.name = "test.docx"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 400

    assert response.json() == {"file": ["File size exceeds the maximum limit of 0 MB."]}
    mock_capture.assert_not_called()


def test_api_documents_create_with_file_extension_not_allowed(settings):
    """
    The uploaded file should not have an allowed extension.
    """
    settings.CONVERSION_FILE_EXTENSIONS_ALLOWED = [".docx"]
    settings.CONVERSION_UPLOAD_ENABLED = True

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    file = BytesIO(b"fake docx content")
    file.name = "test.md"

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            "/api/v1.0/documents/",
            {
                "file": file,
            },
            format="multipart",
        )

    assert response.status_code == 400
    assert response.json() == {
        "file": [
            "File extension .md is not allowed. Allowed extensions are: ['.docx']."
        ]
    }

    mock_capture.assert_not_called()
