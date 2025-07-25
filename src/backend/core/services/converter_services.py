"""Y-Provider API services."""

from base64 import b64encode

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
        return f"Bearer {settings.Y_PROVIDER_API_KEY}"

    def _request(self, url, data, content_type, accept):
        """Make a request to the Y-Provider API."""
        response = requests.post(
            url,
            data=data,
            headers={
                "Authorization": self.auth_header,
                "Content-Type": content_type,
                "Accept": accept,
            },
            timeout=settings.CONVERSION_API_TIMEOUT,
            verify=settings.CONVERSION_API_SECURE,
        )
        response.raise_for_status()
        return response

    def convert(
        self, text, content_type="text/markdown", accept="application/vnd.yjs.doc"
    ):
        """Convert a Markdown text into our internal format using an external microservice."""

        if not text:
            raise ValidationError("Input text cannot be empty")

        try:
            response = self._request(
                f"{settings.Y_PROVIDER_API_BASE_URL}{settings.CONVERSION_API_ENDPOINT}/",
                text,
                content_type,
                accept,
            )
            if accept == "application/vnd.yjs.doc":
                return b64encode(response.content).decode("utf-8")
            if accept in {"text/markdown", "text/html"}:
                return response.text
            if accept == "application/json":
                return response.json()
            raise ValidationError("Unsupported format")
        except requests.RequestException as err:
            raise ServiceUnavailableError(
                "Failed to connect to conversion service",
            ) from err
