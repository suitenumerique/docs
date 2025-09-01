"""Custom validators for the core app."""

from django.core.exceptions import ValidationError


def sub_validator(value):
    """Validate that the sub is ASCII only."""
    if not value.isascii():
        raise ValidationError("Enter a valid sub. This value should be ASCII only.")
