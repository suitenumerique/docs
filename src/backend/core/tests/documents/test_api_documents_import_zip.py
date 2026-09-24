"""Tests for the POST /documents/import-zip/ endpoint."""

import io
import zipfile
from pathlib import Path
from unittest.mock import patch

from django.core.files.storage import default_storage

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.services.converter_services import ConversionError
from core.utils.analytics import PosthogEventName

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).parent.parent / "fixtures"
URL = "/api/v1.0/documents/import-zip/"
YJS = "fakeyjs"


def _make_zip(*entries):
    """Return BytesIO of a zip containing the given (name, bytes) entries."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in entries:
            zf.writestr(name, content)
    buf.seek(0)
    return buf


def test_api_documents_import_zip_anonymous():
    """Anonymous users cannot import a ZIP."""
    response = APIClient().post(URL, {"zip": _make_zip()}, format="multipart")
    assert response.status_code == 401
    assert not models.Document.objects.exists()


def test_api_documents_import_zip_disabled(settings):
    """Returns 400 when CONVERSION_UPLOAD_ENABLED is False."""
    settings.CONVERSION_UPLOAD_ENABLED = False
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.post(URL, {"zip": _make_zip()}, format="multipart")

    assert response.status_code == 400
    assert response.json() == {"zip": ["ZIP import is not allowed"]}
    assert not models.Document.objects.exists()


def test_api_documents_import_zip_missing_field(settings):
    """Returns 400 when no zip field is provided."""
    settings.CONVERSION_UPLOAD_ENABLED = True
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.post(URL, {}, format="multipart")

    assert response.status_code == 400
    assert response.json() == {"zip": ["This field is required."]}


def test_api_documents_import_zip_not_a_zip(settings):
    """Returns 400 when the uploaded file is not a valid ZIP."""
    settings.CONVERSION_UPLOAD_ENABLED = True
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    not_a_zip = io.BytesIO(b"this is not a zip file")
    not_a_zip.name = "export.zip"

    response = client.post(URL, {"zip": not_a_zip}, format="multipart")

    assert response.status_code == 400
    assert response.json() == {"zip": ["Invalid ZIP file."]}


@patch("core.api.viewsets.YHubService")
@patch("core.services.converter_services.Converter.convert")
def test_api_documents_import_zip_success(mock_convert, mock_yhub, settings):
    """201 with correct count and root list; documents and accesses created in DB."""
    settings.CONVERSION_UPLOAD_ENABLED = True
    mock_convert.return_value = YJS

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    with patch("core.api.viewsets.posthog_capture") as mock_capture:
        with open(FIXTURES / "outline-export.zip", "rb") as f:
            response = client.post(URL, {"zip": f}, format="multipart")

    assert response.status_code == 201, response.json()
    data = response.json()

    # 4 children + 2 grandchildren; root "Welcome" is a container, not a page
    assert data["count"] == 6
    assert len(data["roots"]) == 1
    assert data["roots"][0]["title"] == "Welcome"

    assert models.Document.objects.count() == 7

    root = models.Document.objects.get(id=data["roots"][0]["id"])
    assert root.is_root()
    assert root.get_children().count() == 4
    assert models.DocumentAccess.objects.filter(
        document=root, user=user, role=models.RoleChoices.OWNER
    ).exists()

    # Only the root gets an explicit access record; children inherit via the tree
    assert models.DocumentAccess.objects.count() == 1

    getting_started = root.get_children().get(title="Getting Started")
    mock_yhub.return_value.create_ydoc.assert_any_call(getting_started, YJS)
    assert getting_started.get_children().count() == 1
    assert getting_started.get_children().first().title == "rich nested doc"

    what_is_outline = root.get_children().get(title="What is Outline")
    assert what_is_outline.get_children().count() == 1
    assert what_is_outline.get_children().first().title == "nested doc"

    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_IMPORTED,
        user,
        {"format": "zip", "count": 6},
    )


@patch("core.api.viewsets.YHubService")
@patch("core.services.converter_services.Converter.convert")
def test_api_documents_import_zip_media_uploaded(mock_convert, mock_yhub, settings):
    """Media files referenced in .md content are uploaded to S3 and recorded on the document."""
    settings.CONVERSION_UPLOAD_ENABLED = True
    # Pass the markdown through unchanged so the rewritten S3 URL is visible in content.
    mock_convert.side_effect = lambda content, **_: content.decode("utf-8")

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    with open(FIXTURES / "outline-export.zip", "rb") as f:
        response = client.post(URL, {"zip": f}, format="multipart")

    assert response.status_code == 201

    rich = models.Document.objects.get(title="rich nested doc")
    assert len(rich.attachments) == 1

    key = rich.attachments[0]
    assert key.startswith(f"{rich.id}/attachments/")
    assert key.endswith(".jpeg")

    # File is actually in S3
    head = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=key
    )
    assert head["ContentType"] == "image/jpeg"

    # The media URL was rewritten before being handed to the collaboration server
    calls_by_doc = {
        c.args[0]: c.args[1]
        for c in mock_yhub.return_value.create_ydoc.call_args_list
    }
    assert f"/media/{key}" in calls_by_doc[rich]


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_import_zip_conversion_failure_continues(mock_convert, settings):
    """A conversion failure on one node is logged and skipped; other nodes are still created."""
    settings.CONVERSION_UPLOAD_ENABLED = True
    mock_convert.side_effect = ConversionError("boom")

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    buf = _make_zip(
        ("Col/a.md", b"# A"),
        ("Col/b.md", b"# B"),
    )
    buf.name = "export.zip"

    response = client.post(URL, {"zip": buf}, format="multipart")

    assert response.status_code == 201
    assert response.json()["count"] == 2  # a + b; Col is a root container
    assert models.Document.objects.count() == 3


@patch("core.services.converter_services.Converter.convert")
def test_api_documents_import_zip_empty_zip(mock_convert, settings):
    """An empty ZIP returns 201 with zero documents created."""
    settings.CONVERSION_UPLOAD_ENABLED = True

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.post(URL, {"zip": _make_zip()}, format="multipart")

    assert response.status_code == 201
    assert response.json() == {"count": 0, "roots": []}
    assert not models.Document.objects.exists()
    mock_convert.assert_not_called()
