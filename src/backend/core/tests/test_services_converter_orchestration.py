"""Test Converter orchestration services."""

from unittest.mock import MagicMock, patch

from core.services import mime_types
from core.services.converter_services import Converter


@patch("core.services.converter_services.DocSpecConverter")
@patch("core.services.converter_services.YdocConverter")
def test_converter_docx_to_yjs_orchestration(mock_ydoc_class, mock_docspec_class):
    """Test that DOCX to YJS conversion uses both DocSpec and Ydoc converters."""
    # Setup mocks
    mock_docspec = MagicMock()
    mock_ydoc = MagicMock()
    mock_docspec_class.return_value = mock_docspec
    mock_ydoc_class.return_value = mock_ydoc

    # Mock the conversion chain: DOCX -> BlockNote -> YJS
    blocknote_data = b'[{"type": "paragraph", "content": "test"}]'
    yjs_data = "base64encodedyjs"

    mock_docspec.convert.return_value = blocknote_data
    mock_ydoc.convert.return_value = yjs_data

    # Execute conversion
    converter = Converter()
    docx_data = b"fake docx data"
    result = converter.convert(docx_data, mime_types.DOCX, mime_types.YJS)

    # Verify the orchestration
    mock_docspec.convert.assert_called_once_with(
        docx_data, mime_types.DOCX, mime_types.BLOCKNOTE
    )
    mock_ydoc.convert.assert_called_once_with(
        blocknote_data, mime_types.BLOCKNOTE, mime_types.YJS
    )
    assert result == yjs_data


@patch("core.services.converter_services.YdocConverter")
def test_converter_markdown_to_yjs_delegation(mock_ydoc_class):
    """Test that Markdown to YJS conversion is delegated to YdocConverter."""
    mock_ydoc = MagicMock()
    mock_ydoc_class.return_value = mock_ydoc

    yjs_data = "base64encodedyjs"
    mock_ydoc.convert.return_value = yjs_data

    converter = Converter()
    markdown_data = "# Test Document"
    result = converter.convert(markdown_data, mime_types.MARKDOWN, mime_types.YJS)

    mock_ydoc.convert.assert_called_once_with(
        markdown_data, mime_types.MARKDOWN, mime_types.YJS
    )
    assert result == yjs_data


@patch("core.services.converter_services.YdocConverter")
def test_converter_yjs_to_html_delegation(mock_ydoc_class):
    """Test that YJS to HTML conversion is delegated to YdocConverter."""
    mock_ydoc = MagicMock()
    mock_ydoc_class.return_value = mock_ydoc

    html_data = "<p>Test Document</p>"
    mock_ydoc.convert.return_value = html_data

    converter = Converter()
    yjs_data = b"yjs binary data"
    result = converter.convert(yjs_data, mime_types.YJS, mime_types.HTML)

    mock_ydoc.convert.assert_called_once_with(yjs_data, mime_types.YJS, mime_types.HTML)
    assert result == html_data


@patch("core.services.converter_services.YdocConverter")
def test_converter_blocknote_to_yjs_delegation(mock_ydoc_class):
    """Test that BlockNote to YJS conversion is delegated to YdocConverter."""
    mock_ydoc = MagicMock()
    mock_ydoc_class.return_value = mock_ydoc

    yjs_data = "base64encodedyjs"
    mock_ydoc.convert.return_value = yjs_data

    converter = Converter()
    blocknote_data = b'[{"type": "paragraph"}]'
    result = converter.convert(blocknote_data, mime_types.BLOCKNOTE, mime_types.YJS)

    mock_ydoc.convert.assert_called_once_with(
        blocknote_data, mime_types.BLOCKNOTE, mime_types.YJS
    )
    assert result == yjs_data
