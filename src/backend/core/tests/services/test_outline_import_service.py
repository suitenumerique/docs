"""Unit tests for the Outline import service."""

import io
import zipfile
from unittest.mock import patch

import pytest

from core import factories
from core.services.outline_import import OutlineImportError, process_outline_zip

pytestmark = pytest.mark.django_db


def make_zip(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w") as zf:
        for path, content in entries.items():
            zf.writestr(path, content)
    return buf.getvalue()


@patch(
    "core.services.converter_services.YdocConverter.convert",
    return_value="YmFzZTY0Y29udGVudA==",
)
@patch("core.services.outline_import.malware_detection.analyse_file")
@patch(
    "django.core.files.storage.default_storage.connection.meta.client.upload_fileobj"
)
def test_process_outline_zip_happy_path(mock_upload, mock_av, mock_convert):
    user = factories.UserFactory()
    md = b"# T1\n![img](image.png)"
    img = b"i-am-png"
    zip_bytes = make_zip(
        {
            "dir/page.md": md,
            "dir/image.png": img,
            "__MACOSX/._noise": b"",
            ".hidden/skip.md": b"# hidden",
        }
    )

    created = process_outline_zip(user, zip_bytes)
    assert len(created) == 1
    mock_convert.assert_called_once()
    mock_upload.assert_called()
    mock_av.assert_called()


def test_process_outline_zip_zip_slip_rejected():
    user = factories.UserFactory()
    zip_bytes = make_zip(
        {
            "../evil.md": b"# E",
        }
    )
    with pytest.raises(OutlineImportError):
        process_outline_zip(user, zip_bytes)
