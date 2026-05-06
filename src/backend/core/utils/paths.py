"""Path and tree structure utilities."""

from collections import defaultdict


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
