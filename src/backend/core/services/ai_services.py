# core/services/ai_services.py
from __future__ import annotations

import json
from typing import Any, Dict, Generator
from urllib.parse import urlparse

import httpx
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


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


class AIService:
    """
    Backward-compatible proxy service for your existing viewset:

        stream_proxy(provider, url, method, headers, body) -> yields bytes

    Plus: hardening payload so BlockNote tool calls are valid.
    """

    def __init__(self) -> None:
        if not settings.AI_BASE_URL or not settings.AI_API_KEY:
            raise ImproperlyConfigured("AI_BASE_URL and AI_API_KEY must be set")

        self.base_url = str(settings.AI_BASE_URL).rstrip("/")
        self.api_key = str(settings.AI_API_KEY)
        self.allowed_host = urlparse(self.base_url).netloc

    def _assert_allowed_target(self, target_url: str) -> None:
        t = urlparse(target_url)
        if t.scheme not in ("http", "https"):
            raise ValueError("Target URL not allowed")
        if t.netloc != self.allowed_host:
            raise ValueError("Target URL not allowed")

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
        self._assert_allowed_target(url)

        req_headers = self._filtered_headers(dict(headers))
        req_body = self._maybe_harden_json_body(body, req_headers)

        timeout = httpx.Timeout(connect=10.0, read=300.0, write=60.0, pool=10.0)
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            with client.stream(method.upper(), url, headers=req_headers, content=req_body) as r:
                for chunk in r.iter_bytes():
                    if chunk:
                        yield chunk
