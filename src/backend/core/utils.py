"""Utils for the core app."""

import base64
import logging
import re
import time
from collections import defaultdict

from django.core.cache import cache
from django.db import models as db
from django.db.models import Subquery

import pycrdt
from bs4 import BeautifulSoup

from core import enums, models

logger = logging.getLogger(__name__)


def get_ancestor_to_descendants_map(paths, steplen):
    """
    Given a list of document paths, return a mapping of ancestor_path -> set of descendant_paths.

    Each path is assumed to use materialized path format with fixed-length segments.

    Args:
        paths (list of str): List of full document paths.
        steplen (int): Length of each path segment.

    Returns:
        dict[str, set[str]]: Mapping from ancestor path to its descendant paths (including itself).
    """
    ancestor_map = defaultdict(set)
    for path in paths:
        for i in range(steplen, len(path) + 1, steplen):
            ancestor = path[:i]
            ancestor_map[ancestor].add(path)
    return ancestor_map


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


def get_users_sharing_documents_with_cache_key(user):
    """Generate a unique cache key for each user."""
    return f"users_sharing_documents_with_{user.id}"


def users_sharing_documents_with(user):
    """
    Returns a map of users sharing documents with the given user,
    sorted by last shared date.
    """
    start_time = time.time()
    cache_key = get_users_sharing_documents_with_cache_key(user)
    cached_result = cache.get(cache_key)

    if cached_result is not None:
        elapsed = time.time() - start_time
        logger.info(
            "users_sharing_documents_with cache hit for user %s (took %.3fs)",
            user.id,
            elapsed,
        )
        return cached_result

    user_docs_qs = models.DocumentAccess.objects.filter(user=user).values_list(
        "document_id", flat=True
    )
    shared_qs = (
        models.DocumentAccess.objects.filter(document_id__in=Subquery(user_docs_qs))
        .exclude(user=user)
        .values("user")
        .annotate(last_shared=db.Max("created_at"))
    )
    result = {item["user"]: item["last_shared"] for item in shared_qs}
    cache.set(cache_key, result, 86400)  # Cache for 1 day
    elapsed = time.time() - start_time
    logger.info(
        "users_sharing_documents_with cache miss for user %s (took %.3fs)",
        user.id,
        elapsed,
    )
    return result
