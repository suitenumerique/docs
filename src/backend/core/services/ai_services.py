"""AI services."""

import logging
from typing import Generator

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from openai import OpenAI

log = logging.getLogger(__name__)


class AIService:
    """Service class for AI-related operations."""

    def __init__(self):
        """Ensure that the AI configuration is set properly."""
        if (
            settings.AI_BASE_URL is None
            or settings.AI_API_KEY is None
            or settings.AI_MODEL is None
        ):
            raise ImproperlyConfigured("AI configuration not set")
        self.client = OpenAI(base_url=settings.AI_BASE_URL, api_key=settings.AI_API_KEY)

    def proxy(self, data: dict, stream: bool = False) -> Generator[str, None, None]:
        """Proxy AI API requests to the configured AI provider."""
        data["stream"] = stream
        return self.client.chat.completions.create(**data)

    def stream(self, data: dict) -> Generator[str, None, None]:
        """Stream AI API requests to the configured AI provider."""
        stream = self.proxy(data, stream=True)
        for chunk in stream:
            yield (f"data: {chunk.model_dump_json()}\n\n")

        yield ("data: [DONE]\n\n")
