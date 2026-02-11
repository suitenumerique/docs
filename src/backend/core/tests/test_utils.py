"""Test util base64_yjs_to_text."""

import base64
import uuid

from django.core.cache import cache

import pycrdt
import pytest

from core import factories, utils

pytestmark = pytest.mark.django_db

# This base64 string is an example of what is saved in the database.
# This base64 is generated from the blocknote editor, it contains
# the text \n# *Hello* \n- w**or**ld
TEST_BASE64_STRING = (
    "AR717vLVDgAHAQ5kb2N1bWVudC1zdG9yZQMKYmxvY2tHcm91cAcA9e7y1Q4AAw5ibG9ja0NvbnRh"
    "aW5lcgcA9e7y1Q4BAwdoZWFkaW5nBwD17vLVDgIGBgD17vLVDgMGaXRhbGljAnt9hPXu8tUOBAVI"
    "ZWxsb4b17vLVDgkGaXRhbGljBG51bGwoAPXu8tUOAg10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y"
    "1Q4CBWxldmVsAX0BKAD17vLVDgECaWQBdyQwNGQ2MjM0MS04MzI2LTQyMzYtYTA4My00ODdlMjZm"
    "YWQyMzAoAPXu8tUOAQl0ZXh0Q29sb3IBdwdkZWZhdWx0KAD17vLVDgEPYmFja2dyb3VuZENvbG9y"
    "AXcHZGVmYXVsdIf17vLVDgEDDmJsb2NrQ29udGFpbmVyBwD17vLVDhADDmJ1bGxldExpc3RJdGVt"
    "BwD17vLVDhEGBAD17vLVDhIBd4b17vLVDhMEYm9sZAJ7fYT17vLVDhQCb3KG9e7y1Q4WBGJvbGQE"
    "bnVsbIT17vLVDhcCbGQoAPXu8tUOEQ10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y1Q4QAmlkAXck"
    "ZDM1MWUwNjgtM2U1NS00MjI2LThlYTUtYWJiMjYzMTk4ZTJhKAD17vLVDhAJdGV4dENvbG9yAXcH"
    "ZGVmYXVsdCgA9e7y1Q4QD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHSH9e7y1Q4QAw5ibG9ja0Nv"
    "bnRhaW5lcgcA9e7y1Q4eAwlwYXJhZ3JhcGgoAPXu8tUOHw10ZXh0QWxpZ25tZW50AXcEbGVmdCgA"
    "9e7y1Q4eAmlkAXckODk3MDBjMDctZTBlMS00ZmUwLWFjYTItODQ5MzIwOWE3ZTQyKAD17vLVDh4J"
    "dGV4dENvbG9yAXcHZGVmYXVsdCgA9e7y1Q4eD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHQA"
)


def test_utils_base64_yjs_to_text():
    """Test extract text from saved yjs document"""
    assert utils.base64_yjs_to_text(TEST_BASE64_STRING) == "Hello w or ld"


def test_utils_base64_yjs_to_xml():
    """Test extract xml from saved yjs document"""
    content = utils.base64_yjs_to_xml(TEST_BASE64_STRING)
    assert (
        '<heading textAlignment="left" level="1"><italic>Hello</italic></heading>'
        in content
        or '<heading level="1" textAlignment="left"><italic>Hello</italic></heading>'
        in content
    )
    assert (
        '<bulletListItem textAlignment="left">w<bold>or</bold>ld</bulletListItem>'
        in content
    )


def test_utils_extract_attachments():
    """
    All attachment keys in the document content should be extracted.
    """
    document_id = uuid.uuid4()
    image_key1 = f"{document_id!s}/attachments/{uuid.uuid4()!s}.png"
    image_url1 = f"http://localhost/media/{image_key1:s}"

    image_key2 = f"{uuid.uuid4()!s}/attachments/{uuid.uuid4()!s}.png"
    image_url2 = f"http://localhost/{image_key2:s}"

    image_key3 = f"{uuid.uuid4()!s}/attachments/{uuid.uuid4()!s}.png"
    image_url3 = f"http://localhost/media/{image_key3:s}"

    ydoc = pycrdt.Doc()
    frag = pycrdt.XmlFragment(
        [
            pycrdt.XmlElement("img", {"src": image_url1}),
            pycrdt.XmlElement("img", {"src": image_url2}),
            pycrdt.XmlElement("p", {}, [pycrdt.XmlText(image_url3)]),
        ]
    )
    ydoc["document-store"] = frag

    update = ydoc.get_update()
    base64_string = base64.b64encode(update).decode("utf-8")
    # image_key2 is missing the "/media/" part and shouldn't get extracted
    assert utils.extract_attachments(base64_string) == [image_key1, image_key3]


def test_utils_get_ancestor_to_descendants_map_single_path():
    """Test ancestor mapping of a single path."""
    paths = ["000100020005"]
    result = utils.get_ancestor_to_descendants_map(paths, steplen=4)

    assert result == {
        "0001": {"000100020005"},
        "00010002": {"000100020005"},
        "000100020005": {"000100020005"},
    }


def test_utils_get_ancestor_to_descendants_map_multiple_paths():
    """Test ancestor mapping of multiple paths with shared prefixes."""
    paths = ["000100020005", "00010003"]
    result = utils.get_ancestor_to_descendants_map(paths, steplen=4)

    assert result == {
        "0001": {"000100020005", "00010003"},
        "00010002": {"000100020005"},
        "000100020005": {"000100020005"},
        "00010003": {"00010003"},
    }


def test_utils_users_sharing_documents_with_cache_miss():
    """Test cache miss: should query database and cache result."""
    user1 = factories.UserFactory()
    user2 = factories.UserFactory()
    user3 = factories.UserFactory()
    doc1 = factories.DocumentFactory()
    doc2 = factories.DocumentFactory()

    factories.UserDocumentAccessFactory(user=user1, document=doc1)
    factories.UserDocumentAccessFactory(user=user2, document=doc1)
    factories.UserDocumentAccessFactory(user=user3, document=doc2)

    cache_key = utils.get_users_sharing_documents_with_cache_key(user1)
    cache.delete(cache_key)

    result = utils.users_sharing_documents_with(user1)

    assert user2.id in result

    cached_data = cache.get(cache_key)
    assert cached_data == result


def test_utils_users_sharing_documents_with_cache_hit():
    """Test cache hit: should return cached data without querying database."""
    user1 = factories.UserFactory()
    user2 = factories.UserFactory()
    doc1 = factories.DocumentFactory()

    factories.UserDocumentAccessFactory(user=user1, document=doc1)
    factories.UserDocumentAccessFactory(user=user2, document=doc1)

    cache_key = utils.get_users_sharing_documents_with_cache_key(user1)

    test_cached_data = {user2.id: "2025-02-10"}
    cache.set(cache_key, test_cached_data, 86400)

    result = utils.users_sharing_documents_with(user1)
    assert result == test_cached_data


def test_utils_users_sharing_documents_with_cache_invalidation_on_create():
    """Test that cache is invalidated when a DocumentAccess is created."""
    # Create test data
    user1 = factories.UserFactory()
    user2 = factories.UserFactory()
    doc1 = factories.DocumentFactory()

    # Pre-populate cache
    cache_key = utils.get_users_sharing_documents_with_cache_key(user1)
    cache.set(cache_key, {}, 86400)

    # Verify cache exists
    assert cache.get(cache_key) is not None

    # Create new DocumentAccess
    factories.UserDocumentAccessFactory(user=user2, document=doc1)

    # Cache should still exist (only created for user2 who was added)
    # But if we create access for user1 being shared with, cache should be cleared
    cache.set(cache_key, {"test": "data"}, 86400)
    factories.UserDocumentAccessFactory(user=user1, document=doc1)

    # Cache for user1 should be invalidated (cleared)
    assert cache.get(cache_key) is None


def test_utils_users_sharing_documents_with_cache_invalidation_on_delete():
    """Test that cache is invalidated when a DocumentAccess is deleted."""
    user1 = factories.UserFactory()
    user2 = factories.UserFactory()
    doc1 = factories.DocumentFactory()

    doc_access = factories.UserDocumentAccessFactory(user=user1, document=doc1)

    cache_key = utils.get_users_sharing_documents_with_cache_key(user1)
    cache.set(cache_key, {user2.id: "2025-02-10"}, 86400)

    assert cache.get(cache_key) is not None

    doc_access.delete()

    assert cache.get(cache_key) is None


def test_utils_users_sharing_documents_with_empty_result():
    """Test when user is not sharing any documents."""
    user1 = factories.UserFactory()

    cache_key = utils.get_users_sharing_documents_with_cache_key(user1)
    cache.delete(cache_key)

    result = utils.users_sharing_documents_with(user1)

    assert result == {}

    cached_data = cache.get(cache_key)
    assert cached_data == {}
