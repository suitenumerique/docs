"""AI services."""

import logging

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

    def call_ai_api(self, system_content, text):
        """Helper method to call the OpenAI API and process the response."""
        response = self.client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": text},
            ],
        )

        content = response.choices[0].message.content

        if not content:
            raise RuntimeError("AI response does not contain an answer")

        return {"answer": content}

    def proxy(self, data: dict) -> dict:
        """Proxy AI API requests to the configured AI provider."""
        try:
            if "stream" in data:
                data["stream"] = False

            response = self.client.chat.completions.create(**data)
            return response.model_dump()

        except Exception as exc:
            log.error("Error in AI proxy: %s", str(exc))
            raise RuntimeError(f"Failed to proxy AI request: {str(exc)}") from exc
