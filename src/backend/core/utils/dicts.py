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


def lowercase_keys(data):
    """
    Get a copy of a dictionary with all its keys lowercased.

    Useful for object storage metadata: keys are case insensitive per the S3 specification,
    but implementations don't agree on the case they give back, so reading or updating a
    metadata entry by its lowercase name is only reliable after this normalization.

    Args:
        data (dict): Source dictionary

    Returns:
        dict: New dictionary with lowercased keys. When several keys only differ by their
            case, the last one encountered wins.

    Example:
        >>> lowercase_keys({"Owner": "42", "Status": "ready"})
        {"owner": "42", "status": "ready"}
    """
    return {key.lower(): value for key, value in data.items()}
