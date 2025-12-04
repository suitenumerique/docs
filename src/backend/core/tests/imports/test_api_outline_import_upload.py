"""Tests for the Outline zip import API endpoint."""

import io
import zipfile
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile

import pytest
from rest_framework.test import APIClient

from core import factories
from core.api.viewsets import malware_detection
from core.services.outline_import import OutlineImportError


pytestmark = pytest.mark.django_db


def make_zip_with_markdown_and_image(md_path: str, md_content: str, img_path: str, img_bytes: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w") as zf:
        zf.writestr(md_path, md_content)
        zf.writestr(img_path, img_bytes)
    return buf.getvalue()


def test_outline_import_upload_anonymous_forbidden():
    """Anonymous users must not be able to use the import endpoint."""
    client = APIClient()

    # Minimal empty zip
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w"):
        pass
    upload = SimpleUploadedFile(name="export.zip", content=buf.getvalue(), content_type="application/zip")

    response = client.post("/api/v1.0/imports/outline/upload", {"file": upload}, format="multipart")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication credentials were not provided."


@patch("core.services.converter_services.YdocConverter.convert", return_value="YmFzZTY0Y29udGVudA==")
def test_outline_import_upload_authenticated_success(mock_convert):
    """Authenticated users can upload an Outline export zip and create documents."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Markdown referencing a local image in the same directory
    md = "# Imported Title\n\nSome text.\n\n![Alt](image.png)\n"
    img = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00"
        b"\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe"
        b"\xa7V\xbd\xfa\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    zip_bytes = make_zip_with_markdown_and_image(
        md_path="Folder1/page.md",
        md_content=md,
        img_path="Folder1/image.png",
        img_bytes=img,
    )

    upload = SimpleUploadedFile(name="export.zip", content=zip_bytes, content_type="application/zip")

    with patch.object(malware_detection, "analyse_file") as mock_analyse_file:
        response = client.post("/api/v1.0/imports/outline/upload", {"file": upload}, format="multipart")

    assert response.status_code == 201
    data = response.json()
    assert "created_document_ids" in data
    # Only the markdown-backed document ids are returned (container folders are not listed)
    assert len(data["created_document_ids"]) == 1

    # The converter must have been called once per markdown file
    mock_convert.assert_called_once()
    # An antivirus scan is run for the uploaded image
    assert mock_analyse_file.called


def test_outline_import_upload_invalid_zip_returns_validation_error():
    """Invalid archives are rejected with a validation error instead of crashing."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    upload = SimpleUploadedFile(
        name="export.zip",
        content=b"not-a-zip",
        content_type="application/zip",
    )

    response = client.post(
        "/api/v1.0/imports/outline/upload",
        {"file": upload},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.json() == {"file": ["Invalid zip archive"]}


@patch("core.api.imports.process_outline_zip", side_effect=OutlineImportError("boom"))
def test_outline_import_upload_outline_error_returns_validation_error(mock_process_outline):
    """Service-level Outline import errors are surfaced as validation errors."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    zip_bytes = make_zip_with_markdown_and_image(
        md_path="doc.md",
        md_content="# Title",
        img_path="",
        img_bytes=b"",
    )
    upload = SimpleUploadedFile(name="export.zip", content=zip_bytes, content_type="application/zip")

    response = client.post(
        "/api/v1.0/imports/outline/upload",
        {"file": upload},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.json() == {"file": ["boom"]}
    mock_process_outline.assert_called_once()
