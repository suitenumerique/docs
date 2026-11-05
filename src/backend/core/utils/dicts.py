"""Dictionary utility functions."""


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
