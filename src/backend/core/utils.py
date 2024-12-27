"""Utils for the core app."""

import base64

import y_py as Y
from bs4 import BeautifulSoup


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
