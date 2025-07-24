"""Y-Provider API services."""

import json
import logging
from base64 import b64encode

from django.conf import settings

import requests

logger = logging.getLogger(__name__)


class ConversionError(Exception):
    """Base exception for conversion-related errors."""


class ValidationError(ConversionError):
    """Raised when the input validation fails."""


class ServiceUnavailableError(ConversionError):
    """Raised when the conversion service is unavailable."""


class YProviderAPI:
    """Service class for Y-Provider API operations."""

    @property
    def auth_header(self):
        """Build microservice authentication header."""
        # Note: Yprovider microservice accepts only raw token, which is not recommended
        return f"Bearer {settings.Y_PROVIDER_API_KEY}"

    def _request(self, url, data, content_type):
        """Make a request to the Y-Provider API."""
        response = requests.post(
            url,
            data=data,
            headers={
                "Authorization": self.auth_header,
                "Content-Type": content_type,
            },
            timeout=settings.CONVERSION_API_TIMEOUT,
            verify=settings.CONVERSION_API_SECURE,
        )
        response.raise_for_status()
        return response

    def convert(self, text):
        """Convert a Markdown text into our internal format using an external microservice."""

        if not text:
            raise ValidationError("Input text cannot be empty")

        try:
            response = self._request(
                f"{settings.Y_PROVIDER_API_BASE_URL}{settings.CONVERSION_API_ENDPOINT}/",
                text,
                "text/markdown",
            )
            return b64encode(response.content).decode("utf-8")
        except requests.RequestException as err:
            raise ServiceUnavailableError(
                "Failed to connect to backend service",
            ) from err

    def content(self, base64_content, format_type):
        """Convert base64 Yjs content to different formats using the y-provider service."""

        if not base64_content:
            raise ValidationError("Input content cannot be empty")

        data = json.dumps({"content": base64_content, "format": format_type})
        logger.warning(f"{settings.Y_PROVIDER_API_BASE_URL}api/content/")
        try:
            response = self._request(
                f"{settings.Y_PROVIDER_API_BASE_URL}content/", data, "application/json"
            )
            return response.json()
        except requests.RequestException as err:
            raise ServiceUnavailableError(
                "Failed to connect to backend service",
            ) from err
