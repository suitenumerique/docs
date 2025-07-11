"""AI services."""

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from openai import OpenAI

from core import enums


PRESERVE_LANGUAGE_PROMPT = (
    "Do not translate. Strictly keep the original language of the input text. " +
    "For example, if it's French, keep French. If it's English, keep English. "
)
PRESERVE_MARKDOWN_FORMAT = "Preserve markdown formatting. "
DO_NOT_ADD_INFO_PROMPT = (
    "Do not add any extra information or interpret anything beyond the explicit task. "
)

AI_ACTIONS = {
    "prompt": (
        "Answer the given prompt in markdown format. "
        f"{PRESERVE_LANGUAGE_PROMPT} "
        f"{DO_NOT_ADD_INFO_PROMPT}"
    ),
    "correct": (
        "Perform only the following task: correct grammar and spelling. "
        f"{PRESERVE_LANGUAGE_PROMPT} "
        f"{PRESERVE_MARKDOWN_FORMAT} "
        f"{DO_NOT_ADD_INFO_PROMPT}"
    ),
    "rephrase": (
        "Perform only the following task: rephrase the text in the original language. "
        "Do not rephrase in English if it's not in English. "
        f"{PRESERVE_LANGUAGE_PROMPT} "
        f"{PRESERVE_MARKDOWN_FORMAT} "
        f"{DO_NOT_ADD_INFO_PROMPT}"
    ),
    "summarize": (
        "Perform only the following task: summarize. "
        f"{PRESERVE_LANGUAGE_PROMPT} "
        f"{PRESERVE_MARKDOWN_FORMAT} "
        f"{DO_NOT_ADD_INFO_PROMPT}"
    ),
    "beautify": (
        "Perform only the following task: add formatting to the text to make it more readable. "
        f"{PRESERVE_LANGUAGE_PROMPT} "
        f"{DO_NOT_ADD_INFO_PROMPT}"
    ),
    "emojify": (
        "Perform only the following task: add emojis to the important parts of the text. "
        "Do not try to rephrase or replace text. "
        f"{PRESERVE_MARKDOWN_FORMAT} "
        f"{PRESERVE_LANGUAGE_PROMPT} "
        f"{DO_NOT_ADD_INFO_PROMPT}"
    ),
}

AI_TRANSLATE = (
    "Perform only the following task: translate. "
    "Translate the content in the html to the specified language: {language:s}. "
    "Check the translation for accuracy and make any necessary corrections. "
    f"{PRESERVE_LANGUAGE_PROMPT} "
    f"{DO_NOT_ADD_INFO_PROMPT}"
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
