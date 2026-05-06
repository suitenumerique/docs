"""Dictionary utility functions."""

import re


def get_value_by_pattern(data, pattern):
    """
    Get all values from keys matching a regex pattern in a dictionary.

    Args:
        data (dict): Source dictionary to search
        pattern (str): Regex pattern to match against keys

    Returns:
        list: List of values for all matching keys, empty list if no matches

    Example:
        >>> get_value_by_pattern({"title.fr": "Bonjour", "id": 1}, r"^title\\.")
        ["Bonjour"]
        >>> get_value_by_pattern({"title.fr": "Bonjour", "title.en": "Hello"}, r"^title\\.")
        ["Bonjour", "Hello"]
    """
    regex = re.compile(pattern)
    return [value for key, value in data.items() if regex.match(key)]
