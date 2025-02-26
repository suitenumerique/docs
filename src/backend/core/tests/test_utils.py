"""
Unit tests for the User model
"""

from core.utils import sanitize_markup


def test_sanitize_markup():
    """
    Test the sanitize_markup function.
    """

    sanitize_file = sanitize_markup(
        "<svg><script>alert('XSS');</script><iframe>alert('XSS');</iframe>"
        "<foreignObject>alert('XSS');</foreignObject>content</svg>"
    )
    assert sanitize_file == '<?xml version="1.0" encoding="utf-8"?>\n<svg>content</svg>'

    sanitize_file_custom = sanitize_markup(
        "<svg><custom>alert('XSS');</custom>content</svg>", ["custom"]
    )
    assert (
        sanitize_file_custom
        == '<?xml version="1.0" encoding="utf-8"?>\n<svg>content</svg>'
    )
