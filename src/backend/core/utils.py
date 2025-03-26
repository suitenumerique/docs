"""Utils for the core app."""

import base64
import re

import pycrdt
from bs4 import BeautifulSoup

from core import enums


def filter_descendants(paths, root_paths, skip_sorting=False):
    """
    Filters paths to keep only those that are descendants of any path in root_paths.

    A path is considered a descendant of a root path if it starts with the root path.
    If `skip_sorting` is not set to True, the function will sort both lists before
    processing because both `paths` and `root_paths` need to be in lexicographic order
    before going through the algorithm.

    Args:
        paths (iterable of str): List of paths to be filtered.
        root_paths (iterable of str): List of paths to check as potential prefixes.
        skip_sorting (bool): If True, assumes both `paths` and `root_paths` are already sorted.

    Returns:
        list of str: A list of sorted paths that are descendants of any path in `root_paths`.
    """
    results = []
    i = 0
    n = len(root_paths)

    if not skip_sorting:
        paths.sort()
        root_paths.sort()

    for path in paths:
        # Try to find a matching prefix in the sorted accessible paths
        while i < n:
            if path.startswith(root_paths[i]):
                results.append(path)
                break
            if root_paths[i] < path:
                i += 1
            else:
                # If paths[i] > path, no need to keep searching
                break
    return results


def base64_yjs_to_xml(base64_string):
    """Extract xml from base64 yjs document."""

    decoded_bytes = base64.b64decode(base64_string)
    # uint8_array = bytearray(decoded_bytes)

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
