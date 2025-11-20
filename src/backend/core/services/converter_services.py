"""Y-Provider API services."""

from base64 import b64encode

from django.conf import settings

import requests
import typing

from core.services import mime_types

class ConversionError(Exception):
    """Base exception for conversion-related errors."""


class ValidationError(ConversionError):
    """Raised when the input validation fails."""


class ServiceUnavailableError(ConversionError):
    """Raised when the conversion service is unavailable."""


class ConverterProtocol(typing.Protocol):
    def convert(self, text, content_type, accept): ...


class Converter:
    docspec: ConverterProtocol
    ydoc: ConverterProtocol

    def __init__(self):
        self.docspec = DocSpecConverter()
        self.ydoc = YdocConverter()

    def convert(self, input, content_type, accept):
        """Convert input into other formats using external microservices."""
        
        if content_type == mime_types.DOCX and accept == mime_types.YJS:
            return self.convert(
                self.docspec.convert(input, mime_types.DOCX, mime_types.BLOCKNOTE),
                mime_types.BLOCKNOTE,
                mime_types.YJS
            )
        
        return self.ydoc.convert(input, content_type, accept)


class DocSpecConverter:
    """Service class for DocSpec conversion-related operations."""

    def _request(self, url, data, content_type):
        """Make a request to the DocSpec API."""

        response = requests.post(
            url,
            headers={"Accept": mime_types.BLOCKNOTE},
            files={"file": ("document.docx", data, content_type)},
            timeout=settings.CONVERSION_API_TIMEOUT,
            verify=settings.CONVERSION_API_SECURE,
        )
        response.raise_for_status()
        return response
    
    def convert(self, data, content_type, accept):
        """Convert a Document to BlockNote."""
        if not data:
            raise ValidationError("Input data cannot be empty")
        
        if content_type != mime_types.DOCX or accept != mime_types.BLOCKNOTE:
            raise ValidationError(f"Conversion from {content_type} to {accept} is not supported.")
        
        try:
            return self._request(settings.DOCSPEC_API_URL, data, content_type).content
        except requests.RequestException as err:
            raise ServiceUnavailableError(
                "Failed to connect to DocSpec conversion service",
            ) from err


class YdocConverter:
    """Service class for YDoc conversion-related operations."""

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
        self, text, content_type=mime_types.MARKDOWN, accept=mime_types.YJS
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
            if accept == mime_types.YJS:
                return b64encode(response.content).decode("utf-8")
            if accept in {mime_types.MARKDOWN, "text/html"}:
                return response.text
            if accept == mime_types.JSON:
                return response.json()
            raise ValidationError("Unsupported format")
        except requests.RequestException as err:
            raise ServiceUnavailableError(
                f"Failed to connect to YDoc conversion service {content_type}, {accept}",
            ) from err
