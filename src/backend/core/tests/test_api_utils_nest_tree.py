"""Unit tests for the nest_tree utility function."""

import pytest

from core.api.utils import nest_tree


def test_api_utils_nest_tree_empty_list():
    """Test that an empty list returns an empty nested structure."""
    # pylint: disable=use-implicit-booleaness-not-comparison
    assert nest_tree([], 4) is None


def test_api_utils_nest_tree_single_document():
    """Test that a single document is returned as the only root element."""
    documents = [{"id": "1", "path": "0001"}]
    expected = {"id": "1", "path": "0001", "children": []}
    assert nest_tree(documents, 4) == expected


def test_api_utils_nest_tree_multiple_root_documents():
    """Test that multiple root-level documents are correctly added to the root."""
    documents = [
        {"id": "1", "path": "0001"},
        {"id": "2", "path": "0002"},
    ]
    with pytest.raises(
        ValueError,
        match="More than one root element detected.",
    ):
        nest_tree(documents, 4)


def test_api_utils_nest_tree_nested_structure():
    """Test that documents are correctly nested based on path levels."""
    documents = [
        {"id": "1", "path": "0001"},
        {"id": "2", "path": "00010001"},
        {"id": "3", "path": "000100010001"},
        {"id": "4", "path": "00010002"},
    ]
    expected = {
        "id": "1",
        "path": "0001",
        "children": [
            {
                "id": "2",
                "path": "00010001",
                "children": [{"id": "3", "path": "000100010001", "children": []}],
            },
            {"id": "4", "path": "00010002", "children": []},
        ],
    }
    assert nest_tree(documents, 4) == expected


def test_api_utils_nest_tree_siblings_at_same_path():
    """
    Test that sibling documents with the same path are correctly grouped under the same parent.
    """
    documents = [
        {"id": "1", "path": "0001"},
        {"id": "2", "path": "00010001"},
        {"id": "3", "path": "00010002"},
    ]
    expected = {
        "id": "1",
        "path": "0001",
        "children": [
            {"id": "2", "path": "00010001", "children": []},
            {"id": "3", "path": "00010002", "children": []},
        ],
    }
    assert nest_tree(documents, 4) == expected


def test_api_utils_nest_tree_decreasing_path_resets_parent():
    """Test that a document at a lower path resets the parent assignment correctly."""
    documents = [
        {"id": "1", "path": "0001"},
        {"id": "6", "path": "00010001"},
        {"id": "2", "path": "00010002"},  # unordered
        {"id": "5", "path": "000100010001"},
        {"id": "3", "path": "000100010002"},
        {"id": "4", "path": "00010003"},
    ]
    expected = {
        "id": "1",
        "path": "0001",
        "children": [
            {
                "id": "6",
                "path": "00010001",
                "children": [
                    {"id": "5", "path": "000100010001", "children": []},
                    {"id": "3", "path": "000100010002", "children": []},
                ],
            },
            {
                "id": "2",
                "path": "00010002",
                "children": [],
            },
            {"id": "4", "path": "00010003", "children": []},
        ],
    }
    assert nest_tree(documents, 4) == expected
