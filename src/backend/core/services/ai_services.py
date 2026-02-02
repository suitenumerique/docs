"""AI services."""

import json
import logging
from typing import Any, Dict, Generator

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from openai import OpenAIError

from core import enums

if settings.LANGFUSE_PUBLIC_KEY:
    from langfuse.openai import OpenAI
else:
    from openai import OpenAI

log = logging.getLogger(__name__)


BLOCKNOTE_TOOL_STRICT_PROMPT = """
You are editing a BlockNote document via the tool applyDocumentOperations.

You MUST respond ONLY by calling applyDocumentOperations.
The tool input MUST be valid JSON:
{ "operations": [ ... ] }

Each operation MUST include "type" and it MUST be one of:
- "update" (requires: id, block)
- "add"    (requires: referenceId, position, blocks)
- "delete" (requires: id)

VALID SHAPES (FOLLOW EXACTLY):

Update:
{ "type":"update", "id":"<id$>", "block":"<p>...</p>" }
IMPORTANT: "block" MUST be a STRING containing a SINGLE valid HTML element.

Add:
{ "type":"add", "referenceId":"<id$>", "position":"before|after", "blocks":["<p>...</p>"] }
IMPORTANT: "blocks" MUST be an ARRAY OF STRINGS.
Each item MUST be a STRING containing a SINGLE valid HTML element.

Delete:
{ "type":"delete", "id":"<id$>" }

IDs ALWAYS end with "$". Use ids EXACTLY as provided.

Return ONLY the JSON tool input. No prose, no markdown.
"""

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

    def _normalize_tools(self, tools: list) -> list:
        """
        Normalize tool definitions to ensure they have required fields.
        """
        normalized = []
        for tool in tools:
            if isinstance(tool, dict) and tool.get("type") == "function":
                fn = tool.get("function") or {}
                if isinstance(fn, dict) and not fn.get("description"):
                    fn["description"] = f"Tool {fn.get('name', 'unknown')}."
                tool["function"] = fn
            normalized.append(tool)
        return normalized

    def _harden_payload(
        self, payload: Dict[str, Any], stream: bool = False
    ) -> Dict[str, Any]:
        """Harden the AI API payload to enforce compliance and tool usage."""
        payload["stream"] = stream

        # Remove stream_options if stream is False
        if not stream and "stream_options" in payload:
            payload.pop("stream_options")

        # Tools normalization
        if isinstance(payload.get("tools"), list):
            payload["tools"] = self._normalize_tools(payload["tools"])

        # Inject strict system prompt once
        msgs = payload.get("messages")
        if isinstance(msgs, list):
            need = True
            if msgs and isinstance(msgs[0], dict) and msgs[0].get("role") == "system":
                c = msgs[0].get("content") or ""
                if (
                    isinstance(c, str)
                    and "applyDocumentOperations" in c
                    and "blocks" in c
                ):
                    need = False
            if need:
                payload["messages"] = [
                    {"role": "system", "content": BLOCKNOTE_TOOL_STRICT_PROMPT}
                ] + msgs

        return payload

    def proxy(self, data: dict, stream: bool = False) -> Generator[str, None, None]:
        """Proxy AI API requests to the configured AI provider."""
        payload = self._harden_payload(data, stream=stream)
        try:
            return self.client.chat.completions.create(**payload)
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
