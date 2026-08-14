"""AI services."""

import asyncio
import json
import logging
import os
import queue
import threading
from collections.abc import AsyncIterator, Iterator
from functools import cache
from typing import Any, Dict, Union

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from langfuse import get_client
from pydantic_ai import Agent, DeferredToolRequests
from pydantic_ai.capabilities import Instrumentation
from pydantic_ai.models.mistral import MistralModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.mistral import MistralProvider
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets.external import ExternalToolset
from pydantic_ai.ui import SSE_CONTENT_TYPE
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import TextUIPart, UIMessage
from rest_framework.request import Request

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


def convert_async_generator_to_sync(async_gen: AsyncIterator[str]) -> Iterator[str]:
    """Convert an async generator to a sync generator."""
    q: queue.Queue[str | object] = queue.Queue()
    sentinel = object()
    exc_sentinel = object()

    async def run_async_gen():
        try:
            async for async_item in async_gen:
                q.put(async_item)
        except Exception as exc:  # pylint: disable=broad-except #noqa: BLE001
            q.put((exc_sentinel, exc))
        finally:
            q.put(sentinel)

    def start_async_loop():
        asyncio.run(run_async_gen())

    thread = threading.Thread(target=start_async_loop, daemon=True)
    thread.start()

    try:
        while True:
            item = q.get()
            if item is sentinel:
                break
            if isinstance(item, tuple) and item[0] is exc_sentinel:
                # re-raise the exception in the sync context
                raise item[1]
            yield item
    finally:
        thread.join()


@cache
def configure_pydantic_model_provider() -> OpenAIChatModel | MistralModel:
    """Configure a pydantic Model and return it."""
    if (
        settings.OPENAI_SDK_API_KEY
        and settings.OPENAI_SDK_BASE_URL
        and settings.AI_MODEL
    ):
        return OpenAIChatModel(
            settings.AI_MODEL,
            provider=OpenAIProvider(
                api_key=settings.OPENAI_SDK_API_KEY,
                base_url=settings.OPENAI_SDK_BASE_URL,
            ),
        )

    if (
        settings.MISTRAL_SDK_API_KEY
        and settings.MISTRAL_SDK_BASE_URL
        and settings.AI_MODEL
    ):
        return MistralModel(
            settings.AI_MODEL,
            provider=MistralProvider(
                api_key=settings.MISTRAL_SDK_API_KEY,
                base_url=settings.MISTRAL_SDK_BASE_URL,
            ),
        )

    raise ImproperlyConfigured("AI configuration not set")


class AIService:
    """Service class for AI-related operations."""

    @staticmethod
    def inject_document_state_messages(
        messages: list[UIMessage],
    ) -> list[UIMessage]:
        """Inject document state context before user messages.

        Port of BlockNote's injectDocumentStateMessages.
        For each user message carrying documentState metadata, an assistant
        message describing the current document/selection state is prepended
        so the LLM sees it as context.
        """
        result: list[UIMessage] = []
        for message in messages:
            if (
                message.role == "user"
                and isinstance(message.metadata, dict)
                and "documentState" in message.metadata
            ):
                doc_state = message.metadata["documentState"]
                selection = doc_state.get("selection")
                blocks = doc_state.get("blocks")

                if selection:
                    parts = [
                        TextUIPart(
                            text=(
                                "This is the latest state of the selection "
                                "(ignore previous selections, you MUST issue "
                                "operations against this latest version of "
                                "the selection):"
                            ),
                        ),
                        TextUIPart(
                            text=json.dumps(doc_state.get("selectedBlocks")),
                        ),
                        TextUIPart(
                            text=(
                                "This is the latest state of the entire "
                                "document (INCLUDING the selected text), you "
                                "can use this to find the selected text to "
                                "understand the context (but you MUST NOT "
                                "issue operations against this document, you "
                                "MUST issue operations against the selection):"
                            ),
                        ),
                        TextUIPart(text=json.dumps(blocks, ensure_ascii=False)),
                    ]
                else:
                    text = (
                        "There is no active selection. This is the latest "
                        "state of the document (ignore previous documents, "
                        "you MUST issue operations against this latest "
                        "version of the document). The cursor is BETWEEN "
                        "two blocks as indicated by cursor: true."
                    )
                    if doc_state.get("isEmptyDocument"):
                        text += (
                            "Because the document is empty, YOU MUST first "
                            "update the empty block before adding new blocks."
                        )
                    else:
                        text += (
                            "Prefer updating existing blocks over removing "
                            "and adding (but this also depends on the "
                            "user's question)."
                        )
                    parts = [
                        TextUIPart(text=text),
                        TextUIPart(text=json.dumps(blocks, ensure_ascii=False)),
                    ]

                result.append(
                    UIMessage(
                        role="assistant",
                        id=f"assistant-document-state-{message.id}",
                        parts=parts,
                    )
                )

            result.append(message)
        return result

    @staticmethod
    def tool_definitions_to_toolset(
        tool_definitions: Dict[str, Any],
    ) -> ExternalToolset:
        """Convert serialized tool definitions to a pydantic-ai ExternalToolset.

        Port of BlockNote's toolDefinitionsToToolSet.
        Builds ToolDefinition objects from the JSON-Schema-based definitions
        sent by the frontend and wraps them in an ExternalToolset so that
        pydantic-ai advertises them to the LLM without trying to execute them
        server-side (execution is deferred to the frontend).
        """
        tool_defs = [
            ToolDefinition(
                name=name,
                description=defn.get("description", ""),
                parameters_json_schema=defn.get("inputSchema", {}),
                kind="external",
                metadata={
                    "output_schema": defn.get("outputSchema"),
                },
            )
            for name, defn in tool_definitions.items()
        ]
        return ExternalToolset(tool_defs)

    @staticmethod
    def build_instructions(tool_definitions: Dict[str, Any]) -> str | None:
        """Harden the prompt if the applyDocumentOperations tool is used.

        The prompt has to be owned by the server: `VercelAIAdapter` runs with
        `manage_system_prompt="server"` and strips every system prompt submitted by
        the frontend, so injecting it into `run_input.messages` would be silently
        dropped. Agent instructions are injected on each model request whatever the
        `manage_system_prompt` mode is.
        """
        if "applyDocumentOperations" in tool_definitions:
            return BLOCKNOTE_TOOL_STRICT_PROMPT

        return None

    def _build_async_stream(self, request: Request) -> AsyncIterator[str]:
        """Build the async stream from the AI provider."""
        capabilities = None

        if settings.LANGFUSE_PUBLIC_KEY is not None:
            langfuse = get_client()
            langfuse.auth_check()
            capabilities = [Instrumentation()]

        accept = request.META.get("HTTP_ACCEPT", SSE_CONTENT_TYPE)

        run_input = VercelAIAdapter.build_run_input(request.raw_body)

        # Inject document state context into the conversation
        run_input.messages = self.inject_document_state_messages(run_input.messages)

        # Build an ExternalToolset from frontend-supplied tool definitions
        raw_tool_defs = (
            run_input.model_extra.get("toolDefinitions")
            if run_input.model_extra
            else None
        )
        toolset = (
            self.tool_definitions_to_toolset(raw_tool_defs) if raw_tool_defs else None
        )

        agent = Agent(
            configure_pydantic_model_provider(),
            instructions=self.build_instructions(raw_tool_defs)
            if raw_tool_defs
            else None,
            capabilities=capabilities,
        )

        adapter = VercelAIAdapter(
            agent=agent,
            run_input=run_input,
            accept=accept,
            sdk_version=settings.AI_VERCEL_SDK_VERSION,
        )

        event_stream = adapter.run_stream(
            output_type=[str, DeferredToolRequests] if toolset else None,
            toolsets=[toolset] if toolset else None,
        )

        return adapter.encode_stream(event_stream)

    def stream(self, request: Request) -> Union[AsyncIterator[str], Iterator[str]]:
        """Stream AI API requests to the configured AI provider.

        Returns an async iterator when running in async mode (ASGI)
        or a sync iterator when running in sync mode (WSGI).
        """
        async_stream = self._build_async_stream(request)

        if os.environ.get("PYTHON_SERVER_MODE", "sync") == "async":
            return async_stream

        return convert_async_generator_to_sync(async_stream)
