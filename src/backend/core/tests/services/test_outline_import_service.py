"""Unit tests for the Outline import service."""

import io
import zipfile
from unittest.mock import patch

import pytest

from core import factories
from core.services.outline_import import OutlineImportError, process_outline_zip, _preprocess_outline_markdown


pytestmark = pytest.mark.django_db


def make_zip(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w") as zf:
        for path, content in entries.items():
            zf.writestr(path, content)
    return buf.getvalue()


@patch("core.services.converter_services.YdocConverter.convert", return_value="YmFzZTY0Y29udGVudA==")
@patch("core.services.outline_import.malware_detection.analyse_file")
@patch("django.core.files.storage.default_storage.connection.meta.client.upload_fileobj")
def test_process_outline_zip_happy_path(mock_upload, mock_av, mock_convert):
    user = factories.UserFactory()
    md = b"# T1\n![img](image.png)"
    img = b"i-am-png"
    zip_bytes = make_zip({
        "dir/page.md": md,
        "dir/image.png": img,
        "__MACOSX/._noise": b"",
        ".hidden/skip.md": b"# hidden",
    })

    created = process_outline_zip(user, zip_bytes)
    assert len(created) == 1
    mock_convert.assert_called_once()
    mock_upload.assert_called()
    mock_av.assert_called()


def test_process_outline_zip_zip_slip_rejected():
    user = factories.UserFactory()
    zip_bytes = make_zip({
        "../evil.md": b"# E",
    })
    with pytest.raises(OutlineImportError):
        process_outline_zip(user, zip_bytes)


def test_preprocess_outline_markdown_heading_conversions():
    """Test that H4, H5, H6 are properly converted."""
    markdown = """# H1 Title
## H2 Section
### H3 Subsection
#### H4 Content
##### H5 Detail
###### H6 Note
"""
    result = _preprocess_outline_markdown(markdown)

    assert "# H1 Title" in result
    assert "## H2 Section" in result
    assert "### H3 Subsection" in result
    assert "### H4 Content [H4]" in result  # H4 converted to H3 with marker
    assert "**▸ H5 Detail**" in result  # H5 converted to bold with arrow
    assert "▪ H6 Note" in result  # H6 converted to paragraph with bullet


def test_preprocess_outline_markdown_horizontal_rules():
    """Test that horizontal rules are converted to divider blocks."""
    markdown = """Content before
---
Content after
***
More content
___
Final content"""
    result = _preprocess_outline_markdown(markdown)

    assert result.count("[DIVIDER_BLOCK]") == 3
    assert "---" not in result
    assert "***" not in result
    assert "___" not in result


def test_preprocess_outline_markdown_task_lists():
    """Test that task lists are properly handled."""
    markdown = """- [ ] Unchecked task
- [x] Checked task
- Regular list item
  - [ ] Nested unchecked
  - [x] Nested checked"""
    result = _preprocess_outline_markdown(markdown)

    assert "- [ ] Unchecked task" in result
    assert "- [x] Checked task" in result
    assert "- Regular list item" in result
    assert "  - [ ] Nested unchecked" in result
    assert "  - [x] Nested checked" in result


def test_preprocess_outline_markdown_combined():
    """Test combined conversions in a realistic document."""
    markdown = """# Main Title
## Section 1
### Subsection
#### Deep Section
Some content here.
---
##### Important Note
This is important.
###### Small detail
- [ ] Task to do
- [x] Completed task
"""
    result = _preprocess_outline_markdown(markdown)

    assert "# Main Title" in result
    assert "### Deep Section [H4]" in result
    assert "[DIVIDER_BLOCK]" in result
    assert "**▸ Important Note**" in result
    assert "▪ Small detail" in result
    assert "- [ ] Task to do" in result
    assert "- [x] Completed task" in result

