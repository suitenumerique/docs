"""Yjs document conversion utilities."""

import base64
import re

import pycrdt
from bs4 import BeautifulSoup

from core import enums


def base64_yjs_to_xml(base64_string):
    """Extract xml from base64 yjs document."""

    decoded_bytes = base64.b64decode(base64_string)

    doc = pycrdt.Doc()
    doc.apply_update(decoded_bytes)
    return str(doc.get("document-store", type=pycrdt.XmlFragment))


def base64_yjs_to_text(base64_string):
    """Extract text from base64 yjs document."""

    blocknote_structure = base64_yjs_to_xml(base64_string)
    soup = BeautifulSoup(blocknote_structure, "lxml-xml")
    return soup.get_text(separator=" ", strip=True)


def extract_attachments(content):
    """Helper method to extract media paths from a document's content."""
    if not content:
        return []

    xml_content = base64_yjs_to_xml(content)
    return re.findall(enums.MEDIA_STORAGE_URL_EXTRACT, xml_content)
