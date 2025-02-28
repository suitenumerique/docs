"""Utils for the core app."""

import base64
import re

import y_py as Y
from bs4 import BeautifulSoup

from core import enums


def base64_yjs_to_xml(base64_string):
    """Extract xml from base64 yjs document."""

    decoded_bytes = base64.b64decode(base64_string)
    uint8_array = bytearray(decoded_bytes)

    doc = Y.YDoc()  # pylint: disable=E1101
    Y.apply_update(doc, uint8_array)  # pylint: disable=E1101
    return str(doc.get_xml_element("document-store"))


def base64_yjs_to_text(base64_string):
    """Extract text from base64 yjs document."""

    blocknote_structure = base64_yjs_to_xml(base64_string)
    soup = BeautifulSoup(blocknote_structure, "html.parser")
    return soup.get_text(separator=" ").strip()


def extract_attachments(content):
    """Helper method to extract media paths from a document's content."""
    if not content:
        return []

    xml_content = base64_yjs_to_xml(content)
    return re.findall(enums.MEDIA_STORAGE_URL_EXTRACT, xml_content)
