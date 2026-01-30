"""Tests for the Outline zip import API endpoint."""

import io
import zipfile
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile

import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


def make_zip_with_markdown_and_image(
    md_path: str, md_content: str, img_path: str, img_bytes: bytes
) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w") as zf:
        zf.writestr(md_path, md_content)
        if img_path:
            zf.writestr(img_path, img_bytes)
    return buf.getvalue()


def test_outline_import_upload_anonymous_forbidden():
    """Anonymous users must not be able to use the import endpoint."""
    client = APIClient()

    # Minimal empty zip
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w"):
        pass
    upload = SimpleUploadedFile(
        name="export.zip", content=buf.getvalue(), content_type="application/zip"
    )

    response = client.post(
        "/api/v1.0/imports/outline/upload/", {"file": upload}, format="multipart"
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication credentials were not provided."


@patch("core.api.imports.malware_detection")
@patch("core.api.imports.default_storage")
def test_outline_import_upload_authenticated_success(mock_storage, mock_malware):
    """Authenticated users can upload an Outline export zip and get a job back."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

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

    upload = SimpleUploadedFile(
        name="export.zip", content=zip_bytes, content_type="application/zip"
    )

    response = client.post(
        "/api/v1.0/imports/outline/upload/", {"file": upload}, format="multipart"
    )

    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "pending"
    assert "status_url" in data

    # The zip file should have been saved to S3
    mock_storage.save.assert_called_once()


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
        "/api/v1.0/imports/outline/upload/",
        {"file": upload},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.json() == {"file": ["Invalid zip archive"]}


def test_outline_import_upload_non_zip_extension_rejected():
    """Non-zip file extensions are rejected."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    upload = SimpleUploadedFile(
        name="export.tar.gz",
        content=b"some content",
        content_type="application/gzip",
    )

    response = client.post(
        "/api/v1.0/imports/outline/upload/",
        {"file": upload},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.json() == {"file": ["Must be a .zip file"]}
