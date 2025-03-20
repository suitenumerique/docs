"""
Unit tests for the filter_root_paths utility function.
"""

from core.api.utils import filter_root_paths


def test_api_utils_filter_root_paths_success():
    """
    The `filter_root_paths` function should correctly identify root paths
    from a given list of paths.

    This test uses a list of paths with missing intermediate paths to ensure that
    only the minimal set of root paths is returned.
    """
    paths = [
        "0001",
        "00010001",
        "000100010001",
        "000100010002",
        # missing 00010002
        "000100020001",
        "000100020002",
        "0002",
        "00020001",
        "00020002",
        # missing 0003
        "00030001",
        "000300010001",
        "00030002",
        # missing 0004
        # missing 00040001
        # missing 000400010001
        # missing 000400010002
        "000400010003",
        "0004000100030001",
        "000400010004",
    ]
    filtered_paths = filter_root_paths(paths, skip_sorting=True)
    assert filtered_paths == [
        "0001",
        "0002",
        "00030001",
        "00030002",
        "000400010003",
        "000400010004",
    ]


def test_api_utils_filter_root_paths_sorting():
    """
    The `filter_root_paths` function should fail is sorting is skipped and paths are not sorted.

    This test verifies that when sorting is skipped, the function respects the input order, and
    when sorting is enabled, the result is correctly ordered and minimal.
    """
    paths = [
        "0001",
        "00010001",
        "000100010001",
        "000100020002",
        "000100010002",
        "000100020001",
        "00020001",
        "0002",
        "00020002",
        "000300010001",
        "00030001",
        "00030002",
        "0004000100030001",
        "000400010003",
        "000400010004",
    ]
    filtered_paths = filter_root_paths(paths, skip_sorting=True)
    assert filtered_paths == [
        "0001",
        "00020001",
        "0002",
        "000300010001",
        "00030001",
        "00030002",
        "0004000100030001",
        "000400010003",
        "000400010004",
    ]
    filtered_paths = filter_root_paths(paths)
    assert filtered_paths == [
        "0001",
        "0002",
        "00030001",
        "00030002",
        "000400010003",
        "000400010004",
    ]
