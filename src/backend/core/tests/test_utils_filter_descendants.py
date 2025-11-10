"""
Unit tests for the filter_root_paths utility function.
"""

from core.utils import filter_descendants


def test_utils_filter_descendants_success():
    """
    The `filter_descendants` function should correctly identify descendant paths
    from a given list of paths and root paths.

    This test verifies that the function returns only the paths that have a prefix
    matching one of the root paths.
    """
    paths = [
        "0001",
        "00010001",
        "000100010001",
        "000100010002",
        "000100020001",
        "000100020002",
        "0002",
        "00020001",
        "00020002",
        "00030001",
        "000300010001",
        "00030002",
        "0004",
        "000400010003",
        "0004000100030001",
        "000400010004",
    ]
    root_paths = [
        "0001",
        "0002",
        "000400010003",
    ]
    filtered_paths = filter_descendants(paths, root_paths, skip_sorting=True)
    assert filtered_paths == [
        "0001",
        "00010001",
        "000100010001",
        "000100010002",
        "000100020001",
        "000100020002",
        "0002",
        "00020001",
        "00020002",
        "000400010003",
        "0004000100030001",
    ]


def test_utils_filter_descendants_sorting():
    """
    The `filter_descendants` function should handle unsorted input when sorting is enabled.

    This test verifies that the function sorts the input if sorting is not skipped
    and still correctly identifies accessible descendant paths.
    """
    paths = [
        "000300010001",
        "000100010002",
        "0001",
        "00010001",
        "000100010001",
        "000100020002",
        "000100020001",
        "0002",
        "00020001",
        "00020002",
        "00030001",
        "00030002",
        "0004000100030001",
        "0004",
        "000400010003",
        "000400010004",
    ]
    root_paths = [
        "0002",
        "000400010003",
        "0001",
    ]
    filtered_paths = filter_descendants(paths, root_paths)
    assert filtered_paths == [
        "0001",
        "00010001",
        "000100010001",
        "000100010002",
        "000100020001",
        "000100020002",
        "0002",
        "00020001",
        "00020002",
        "000400010003",
        "0004000100030001",
    ]

    filtered_paths = filter_descendants(paths, root_paths, skip_sorting=True)
    assert filtered_paths == [
        "0001",
        "00010001",
        "000100010001",
        "000100010002",
        "000100020001",
        "000100020002",
        "0002",
        "00020001",
        "00020002",
        "000400010003",
        "0004000100030001",
    ]


def test_utils_filter_descendants_empty():
    """
    The function should return an empty list if one or both inputs are empty.
    """
    assert not filter_descendants([], ["0001"])
    assert not filter_descendants(["0001"], [])
    assert not filter_descendants([], [])


def test_utils_filter_descendants_no_match():
    """
    The function should return an empty list if no path starts with any root path.
    """
    paths = ["0001", "0002", "0003"]
    root_paths = ["0004", "0005"]
    assert not filter_descendants(paths, root_paths, skip_sorting=True)


def test_utils_filter_descendants_exact_match():
    """
    The function should include paths that exactly match a root path.
    """
    paths = ["0001", "0002", "0003"]
    root_paths = ["0001", "0002"]
    assert filter_descendants(paths, root_paths, skip_sorting=True) == ["0001", "0002"]


def test_utils_filter_descendants_single_root_matches_all():
    """
    A single root path should match all its descendants.
    """
    paths = ["0001", "00010001", "000100010001", "00010002"]
    root_paths = ["0001"]
    assert filter_descendants(paths, root_paths) == [
        "0001",
        "00010001",
        "000100010001",
        "00010002",
    ]


def test_utils_filter_descendants_path_shorter_than_root():
    """
    A path shorter than any root path should not match.
    """
    paths = ["0001", "0002"]
    root_paths = ["00010001"]
    assert not filter_descendants(paths, root_paths)
