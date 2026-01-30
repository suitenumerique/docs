"""AI services."""
from __future__ import annotations

import json
from typing import Any, Dict, Generator

import httpx
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from core import enums

import logging

if settings.LANGFUSE_PUBLIC_KEY:
    from langfuse.openai import OpenAI
else:
    from openai import OpenAI, OpenAIError
    
log = logging.getLogger(__name__)


BLOCKNOTE_TOOL_STRICT_PROMPT = """You are editing a BlockNote document via the tool applyDocumentOperations.

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


def _drop_nones(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _drop_nones(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, list):
        return [_drop_nones(v) for v in obj]
    return obj


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
        self.api_key = settings.AI_API_KEY
        self.client = OpenAI(base_url=settings.AI_BASE_URL, api_key=self.api_key)

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


    def _filtered_headers(self, incoming_headers: Dict[str, str]) -> Dict[str, str]:
        hop_by_hop = {"host", "connection", "content-length", "accept-encoding"}
        out: Dict[str, str] = {}
        for k, v in incoming_headers.items():
            lk = k.lower()
            if lk in hop_by_hop:
                continue
            if lk == "authorization":
                # Client auth is for Django only, not upstream
                continue
            out[k] = v

        out["Authorization"] = f"Bearer {self.api_key}"
        return out

    def _normalize_tools(self, tools: list) -> list:
        normalized = []
        for tool in tools:
            if isinstance(tool, dict) and tool.get("type") == "function":
                fn = tool.get("function") or {}
                if isinstance(fn, dict) and not fn.get("description"):
                    fn["description"] = f"Tool {fn.get('name', 'unknown')}."
                tool["function"] = fn
            normalized.append(_drop_nones(tool))
        return normalized

    def _harden_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        payload = dict(payload)

        # Enforce server model (important with Albert routing)
        if getattr(settings, "AI_MODEL", None):
            payload["model"] = settings.AI_MODEL

        # Compliance
        payload["temperature"] = 0

        # Tools normalization
        if isinstance(payload.get("tools"), list):
            payload["tools"] = self._normalize_tools(payload["tools"])

        # Force tool call if tools exist
        if payload.get("tools"):
            payload["tool_choice"] = {"type": "function", "function": {"name": "applyDocumentOperations"}}

        # Convert non-standard "required"
        if payload.get("tool_choice") == "required":
            payload["tool_choice"] = {"type": "function", "function": {"name": "applyDocumentOperations"}}

        # Inject strict system prompt once
        msgs = payload.get("messages")
        if isinstance(msgs, list):
            need = True
            if msgs and isinstance(msgs[0], dict) and msgs[0].get("role") == "system":
                c = msgs[0].get("content") or ""
                if isinstance(c, str) and "applyDocumentOperations" in c and "blocks" in c:
                    need = False
            if need:
                payload["messages"] = [{"role": "system", "content": BLOCKNOTE_TOOL_STRICT_PROMPT}] + msgs

        return _drop_nones(payload)

    def _maybe_harden_json_body(self, body: bytes, headers: Dict[str, str]) -> bytes:
        ct = (headers.get("Content-Type") or headers.get("content-type") or "").lower()
        if "application/json" not in ct:
            return body
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            return body
        if isinstance(payload, dict):
            payload = self._harden_payload(payload)
            return json.dumps(payload, ensure_ascii=False).encode("utf-8")
        return body

    def stream_proxy(
        self,
        *,
        url: str,
        method: str,
        headers: Dict[str, str],
        body: bytes,
    ) -> Generator[bytes, None, None]:
        req_headers = self._filtered_headers(dict(headers))
        req_body = self._maybe_harden_json_body(body, req_headers)

        timeout = httpx.Timeout(connect=10.0, read=300.0, write=60.0, pool=10.0)
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            with client.stream(method.upper(), url, headers=req_headers, content=req_body) as r:
                for chunk in r.iter_bytes():
                    if chunk:
                        yield chunk
