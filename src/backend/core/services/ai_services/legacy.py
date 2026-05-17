"""Module dedicated to the legacy ai services."""

import logging
from abc import ABC, abstractmethod
from functools import cache

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from langfuse import get_client, observe
from langfuse.openai import OpenAI as OpenAI_Langfuse
from mistralai import Mistral

from core import enums

if settings.LANGFUSE_PUBLIC_KEY:
    OpenAI = OpenAI_Langfuse
else:
    from openai import OpenAI

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
    "Do not provide any other information. "
    "Return the content directly without wrapping it in code blocks or markdown delimiters."
)


class LegacyAiClient(ABC):
    """abstract class for legacy client."""

    @abstractmethod
    def call_ai_api(self, system_content, text) -> str:
        """Abstract method call_ai_api."""


class LegacyAiServiceMistralClient(LegacyAiClient):
    """ai_service using mistral sdk for the legacy ai feature."""

    def __init__(self):
        """Configure mistral sdk"""
        if (
            not settings.MISTRAL_SDK_API_KEY
            or not settings.MISTRAL_SDK_BASE_URL
            or not settings.AI_MODEL
        ):
            raise ImproperlyConfigured("Mistral sdk configuration not set")

        self.client = Mistral(
            api_key=settings.MISTRAL_SDK_API_KEY,
            server_url=settings.MISTRAL_SDK_BASE_URL,
        )

    @observe(as_type="generation")
    def call_ai_api(self, system_content, text) -> str:
        langfuse = None
        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": text},
        ]
        if settings.LANGFUSE_PUBLIC_KEY:
            langfuse = get_client()
            langfuse.auth_check()

            langfuse.update_current_generation(
                input=messages,
                model=settings.AI_MODEL,
            )

        response = self.client.chat.complete(
            model=settings.AI_MODEL,
            messages=messages,
            stream=False,
        )

        if not response.choices or response.choices[0].message is None:
            raise ValueError("LLM returned empty or filtered response")

        if langfuse:
            langfuse.update_current_generation(
                usage_details={
                    "input": response.usage.prompt_tokens,
                    "output": response.usage.completion_tokens,
                },
                output=response.choices[0].message.content,
            )

        return response.choices[0].message.content


class LegacyAiServiceOpenAiClient(LegacyAiClient):
    """ai_service using OpenAI client for the legacy ai feature."""

    def __init__(self):
        """configure OpenAI client."""
        if (
            not settings.OPENAI_SDK_BASE_URL
            or not settings.OPENAI_SDK_API_KEY
            or not settings.AI_MODEL
        ):
            raise ImproperlyConfigured("OpenAI configuration not set")
        self.client = OpenAI(
            base_url=settings.OPENAI_SDK_BASE_URL, api_key=settings.OPENAI_SDK_API_KEY
        )

    def call_ai_api(self, system_content, text) -> str:
        response = self.client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": text},
            ],
        )

        if not response.choices or response.choices[0].message is None:
            raise ValueError("LLM returned empty or filtered response")
        return response.choices[0].message.content


class LegacyAIService:
    """Legacy ai service used by transform and translate actions."""

    def __init__(self, ai_client: LegacyAiClient):
        """Assign client to the service."""
        self.ai_client = ai_client

    def call_ai_api(self, system_content, text):
        """Helper method to call the OpenAI API and process the response."""

        content = self.ai_client.call_ai_api(system_content, text)

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


@cache
def get_legacy_ai_service() -> LegacyAIService:
    """Helper responsible to correctly instantiate and configure legacy ai service."""

    ai_client = None

    if settings.MISTRAL_SDK_API_KEY:
        ai_client = LegacyAiServiceMistralClient()

    if settings.OPENAI_SDK_API_KEY:
        ai_client = LegacyAiServiceOpenAiClient()

    if not ai_client:
        raise ImproperlyConfigured(
            "trying to configure legacy ai_service but missing client configuration."
        )

    return LegacyAIService(ai_client)
