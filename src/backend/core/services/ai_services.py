"""AI services."""

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from rest_framework.response import Response
from openai import OpenAI
import logging
from core import enums

log = logging.getLogger(__name__)

AI_ACTIONS = {
    "prompt": (
        "Answer the prompt in markdown format. "
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
    
    def proxy(self, data:dict) -> dict:
        """Proxy AI API requests to the configured AI provider."""
        try:
            if 'stream' in data:
                data['stream'] = False

            log.debug(f"Proxying AI request with data: {data}")

            response = self.client.chat.completions.create(**data)
            return response.model_dump()
        
        except Exception as exc:
            log.error(f"Error in AI proxy: {str(exc)}")
            raise RuntimeError(f"Failed to proxy AI request: {str(exc)}") from exc