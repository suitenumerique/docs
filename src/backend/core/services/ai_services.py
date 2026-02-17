"""AI services."""

import asyncio
import json
import logging
import os
import queue
import threading
from collections.abc import AsyncIterator, Iterator
from typing import Any, Dict, Union

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from langfuse import get_client
from langfuse.openai import OpenAI as OpenAI_Langfuse
from pydantic_ai import Agent, DeferredToolRequests
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets.external import ExternalToolset
from pydantic_ai.ui import SSE_CONTENT_TYPE
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import TextUIPart, UIMessage
from rest_framework.request import Request

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
    "Do not provide any other information."
)


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
                        TextUIPart(text=json.dumps(blocks)),
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
                        TextUIPart(text=json.dumps(blocks)),
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

    def _build_async_stream(self, request: Request) -> AsyncIterator[str]:
        """Build the async stream from the AI provider."""
        instrument_enabled = settings.LANGFUSE_PUBLIC_KEY is not None

        if instrument_enabled:
            langfuse = get_client()
            langfuse.auth_check()
            Agent.instrument_all()

        model = OpenAIChatModel(
            settings.AI_MODEL,
            provider=OpenAIProvider(
                base_url=settings.AI_BASE_URL, api_key=settings.AI_API_KEY
            ),
        )
        agent = Agent(model, instrument=instrument_enabled)

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
