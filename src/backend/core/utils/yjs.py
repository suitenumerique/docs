"""Yjs document conversion utilities."""

import base64
import re
from urllib.parse import quote

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


def _xml_elements(node):
    """Every element under a fragment or an element, depth first."""
    for child in node.children:
        if isinstance(child, pycrdt.XmlElement):
            yield child
            yield from _xml_elements(child)


def replace_attachment_keys(update, mapping):
    """
    The raw Yjs update of a document whose attachments moved to new keys: each
    element's `url` naming an old key names its new one, in the `/media/<key>` form
    as in the `media-check/?key=` form (the key URL-encoded there). The same rewrite
    the frontend makes when it removes a document's encryption, returned as the full
    state of the document. The `blockUploadUrl` of an upload loader too (a file whose
    scan had not ended when its uploader left): it becomes the file's block once
    the scan of its new key answers, while its old key would answer nothing.
    """
    doc = pycrdt.Doc()
    doc.apply_update(update)
    fragment = doc.get("document-store", type=pycrdt.XmlFragment)
    replacements = [
        pair
        for old, new in mapping.items()
        for pair in ((old, new), (quote(old, safe=""), quote(new, safe="")))
    ]

    with doc.transaction():
        for element in _xml_elements(fragment):
            for name in ("url", "blockUploadUrl"):
                url = element.attributes.get(name)

                if not isinstance(url, str):
                    continue

                rewritten = url

                for old, new in replacements:
                    rewritten = rewritten.replace(old, new)

                if rewritten != url:
                    element.attributes[name] = rewritten

    return doc.get_update()
