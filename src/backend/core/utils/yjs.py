"""Yjs document conversion utilities."""

import base64
import re

import pycrdt
from bs4 import BeautifulSoup

from core import enums


def yjs_to_xml(update):
    """Extract xml from a raw yjs update."""

    doc = pycrdt.Doc()
    doc.apply_update(update)
    return str(doc.get("document-store", type=pycrdt.XmlFragment))


def base64_yjs_to_xml(base64_string):
    """Extract xml from base64 yjs document."""

    return yjs_to_xml(base64.b64decode(base64_string))


def yjs_to_text(update):
    """Extract text from a raw yjs update."""

    soup = BeautifulSoup(yjs_to_xml(update), "lxml-xml")
    return soup.get_text(separator=" ", strip=True)


def base64_yjs_to_text(base64_string):
    """Extract text from base64 yjs document."""

    return yjs_to_text(base64.b64decode(base64_string))


def extract_attachments(content):
    """Helper method to extract media paths from a document's content."""
    if not content:
        return []

    xml_content = base64_yjs_to_xml(content)
    return re.findall(enums.MEDIA_STORAGE_URL_EXTRACT, xml_content)


def extract_attachments_from_update(update):
    """Helper method to extract media paths from a raw yjs update."""
    if not update:
        return []

    return re.findall(enums.MEDIA_STORAGE_URL_EXTRACT, yjs_to_xml(update))
