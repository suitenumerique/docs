"""Converter services."""

from django.conf import settings

import requests


class ConversionError(Exception):
    """Base exception for conversion-related errors."""


class ValidationError(ConversionError):
    """Raised when the input validation fails."""


class ServiceUnavailableError(ConversionError):
    """Raised when the conversion service is unavailable."""


class YdocConverter:
    """Service class for conversion-related operations."""

    @property
    def auth_header(self):
        """Build microservice authentication header."""
        # Note: Yprovider microservice accepts only raw token, which is not recommended
        return settings.Y_PROVIDER_API_KEY

    def convert_markdown(self, text):
        """Convert a Markdown text into our internal format using an external microservice."""

        if not text:
            raise ValidationError("Input text cannot be empty")

        try:
            response = requests.post(
                f"{settings.Y_PROVIDER_API_BASE_URL}{settings.CONVERSION_API_ENDPOINT}/",
                data=text,
                headers={
                    "Authorization": self.auth_header,
                    "Content-Type": "text/markdown",
                },
                timeout=settings.CONVERSION_API_TIMEOUT,
                verify=settings.CONVERSION_API_SECURE,
            )
            response.raise_for_status()
            return response.content
        except requests.RequestException as err:
            raise ServiceUnavailableError(
                "Failed to connect to conversion service",
            ) from err
