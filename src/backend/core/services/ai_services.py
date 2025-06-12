"""AI services."""

import json
import logging
from typing import Generator

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from openai import OpenAI as OpenAI_Client
from openai import OpenAIError

from core import enums

if settings.LANGFUSE_PUBLIC_KEY:
    from langfuse.openai import OpenAI
else:
    OpenAI = OpenAI_Client
    
log = logging.getLogger(__name__)


AI_ACTIONS = {
    "prompt": (
        "Answer the prompt using markdown formatting for structure and emphasis. "
        "Return the content directly without wrapping it in code blocks or markdown delimiters. "
        "Preserve the language and markdown formatting. "
        "Do not provide any other information. "
        "Preserve the language."
    ),
    "correct": (
        "Correct grammar and spelling of the markdown text, "
        "preserving language and markdown formatting. "
        "Do not provide any other information. "
        "Preserve the language."
    ),
    "rephrase": (
        "Rephrase the given markdown text, "
        "preserving language and markdown formatting. "
        "Do not provide any other information. "
        "Preserve the language."
    ),
    "summarize": (
        "Summarize the markdown text, preserving language and markdown formatting. "
        "Do not provide any other information. "
        "Preserve the language."
    ),
    "beautify": (
        "Add formatting to the text to make it more readable. "
        "Do not provide any other information. "
        "Preserve the language."
    ),
    "emojify": (
        "Add emojis to the important parts of the text. "
        "Do not provide any other information. "
        "Preserve the language."
    ),
}

AI_TRANSLATE = (
    "Keep the same html structure and formatting. "
    "Translate the content in the html to the specified language {language:s}. "
    "Check the translation for accuracy and make any necessary corrections. "
    "Do not provide any other information."
)


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

    def transform(self, text, action):
        """Transform text based on specified action."""
        system_content = AI_ACTIONS[action]
        return self.call_ai_api(system_content, text)

    def translate(self, text, language):
        """Translate text to a specified language."""
        language_display = enums.ALL_LANGUAGES.get(language, language)
        system_content = AI_TRANSLATE.format(language=language_display)
        return self.call_ai_api(system_content, text)

    def proxy(self, data: dict, stream: bool = False) -> Generator[str, None, None]:
        """Proxy AI API requests to the configured AI provider."""
        data["stream"] = stream
        try:
            return self.client.chat.completions.create(**data)
        except OpenAIError as e:
            raise RuntimeError(f"Failed to proxy AI request: {e}") from e

    def stream(self, data: dict) -> Generator[str, None, None]:
        """Stream AI API requests to the configured AI provider."""

        try:
            stream = self.proxy(data, stream=True)
            for chunk in stream:
                try:
                    chunk_dict = (
                        chunk.model_dump() if hasattr(chunk, "model_dump") else chunk
                    )
                    chunk_json = json.dumps(chunk_dict)
                    yield f"data: {chunk_json}\n\n"
                except (AttributeError, TypeError) as e:
                    log.error("Error serializing chunk: %s, chunk: %s", e, chunk)
                    continue
        except (OpenAIError, RuntimeError, OSError, ValueError) as e:
            log.error("Streaming error: %s", e)

        yield "data: [DONE]\n\n"
