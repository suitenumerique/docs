"""
Test AI services in the impress core app.
"""
# pylint: disable=protected-access

from collections.abc import AsyncIterator
from unittest.mock import MagicMock, patch

from django.core.exceptions import ImproperlyConfigured
from django.test.utils import override_settings

import pytest
from openai import OpenAIError
from pydantic_ai.ui.vercel_ai.request_types import TextUIPart, UIMessage

from core.services.ai_services import (
    BLOCKNOTE_TOOL_STRICT_PROMPT,
    AIService,
    convert_async_generator_to_sync,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def ai_settings(settings):
    """Fixture to set AI settings."""
    settings.AI_MODEL = "llama"
    settings.AI_BASE_URL = "http://example.com"
    settings.AI_API_KEY = "test-key"
    settings.AI_FEATURE_ENABLED = True
    settings.AI_FEATURE_BLOCKNOTE_ENABLED = True
    settings.AI_FEATURE_LEGACY_ENABLED = True
    settings.LANGFUSE_PUBLIC_KEY = None
    settings.AI_VERCEL_SDK_VERSION = 6


# -- AIService.__init__ --


@pytest.mark.parametrize(
    "setting_name, setting_value",
    [
        ("AI_BASE_URL", None),
        ("AI_API_KEY", None),
        ("AI_MODEL", None),
    ],
)
def test_services_ai_setting_missing(setting_name, setting_value, settings):
    """Setting should be set"""
    setattr(settings, setting_name, setting_value)

    with pytest.raises(
        ImproperlyConfigured,
        match="AI configuration not set",
    ):
        AIService()


# -- AIService.transform --


@override_settings(
    AI_BASE_URL="http://example.com", AI_API_KEY="test-key", AI_MODEL="test-model"
)
@patch("openai.resources.chat.completions.Completions.create")
def test_services_ai_client_error(mock_create):
    """Fail when the client raises an error"""

    mock_create.side_effect = OpenAIError("Mocked client error")

    with pytest.raises(
        OpenAIError,
        match="Mocked client error",
    ):
        AIService().transform("hello", "prompt")


@override_settings(
    AI_BASE_URL="http://example.com", AI_API_KEY="test-key", AI_MODEL="test-model"
)
@patch("openai.resources.chat.completions.Completions.create")
def test_services_ai_client_invalid_response(mock_create):
    """Fail when the client response is invalid"""

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=None))]
    )

    with pytest.raises(
        RuntimeError,
        match="AI response does not contain an answer",
    ):
        AIService().transform("hello", "prompt")


@override_settings(
    AI_BASE_URL="http://example.com", AI_API_KEY="test-key", AI_MODEL="test-model"
)
@patch("openai.resources.chat.completions.Completions.create")
def test_services_ai_success(mock_create):
    """The AI request should work as expect when called with valid arguments."""

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Salut"))]
    )

    response = AIService().transform("hello", "prompt")

    assert response == {"answer": "Salut"}


# -- AIService.translate --


@patch("openai.resources.chat.completions.Completions.create")
def test_services_ai_translate_success(mock_create):
    """Translate should call the AI API with the correct language prompt."""

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Bonjour"))]
    )

    response = AIService().translate("<p>Hello</p>", "fr")

    assert response == {"answer": "Bonjour"}
    call_args = mock_create.call_args
    system_content = call_args[1]["messages"][0]["content"]
    assert "French" in system_content or "fr" in system_content


@patch("openai.resources.chat.completions.Completions.create")
def test_services_ai_translate_unknown_language(mock_create):
    """Translate with an unknown language code should use the code as-is."""

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Translated"))]
    )

    response = AIService().translate("<p>Hello</p>", "xx-unknown")

    assert response == {"answer": "Translated"}
    call_args = mock_create.call_args
    system_content = call_args[1]["messages"][0]["content"]
    assert "xx-unknown" in system_content


# -- convert_async_generator_to_sync --


def test_convert_async_generator_to_sync_basic():
    """Should convert an async generator yielding items to a sync iterator."""

    async def async_gen():
        for item in ["hello", "world", "!"]:
            yield item

    result = list(convert_async_generator_to_sync(async_gen()))
    assert result == ["hello", "world", "!"]


def test_convert_async_generator_to_sync_empty():
    """Should handle an empty async generator."""

    async def async_gen():
        return
        yield

    result = list(convert_async_generator_to_sync(async_gen()))
    assert not result


def test_convert_async_generator_to_sync_exception():
    """Should propagate exceptions from the async generator."""

    async def async_gen():
        yield "first"
        raise ValueError("async error")

    sync_iter = convert_async_generator_to_sync(async_gen())
    assert next(sync_iter) == "first"

    with pytest.raises(ValueError, match="async error"):
        next(sync_iter)


# -- AIService.inject_document_state_messages --


def test_inject_document_state_messages_no_metadata():
    """Messages without documentState metadata should pass through unchanged."""
    messages = [
        UIMessage(role="user", id="msg-1", parts=[TextUIPart(text="Hello")]),
    ]

    result = AIService.inject_document_state_messages(messages)

    assert len(result) == 1
    assert result[0].id == "msg-1"


def test_inject_document_state_messages_with_selection():
    """A user message with documentState and selection should get an
    assistant context message prepended."""
    messages = [
        UIMessage(
            role="user",
            id="msg-1",
            parts=[TextUIPart(text="Fix this")],
            metadata={
                "documentState": {
                    "selection": {"start": 0, "end": 5},
                    "selectedBlocks": [{"type": "paragraph", "content": "Hello"}],
                    "blocks": [
                        {"type": "paragraph", "content": "Hello"},
                        {"type": "paragraph", "content": "World"},
                    ],
                }
            },
        ),
    ]

    result = AIService.inject_document_state_messages(messages)

    assert len(result) == 2
    # First message should be the injected assistant context
    assert result[0].role == "assistant"
    assert result[0].id == "assistant-document-state-msg-1"
    assert len(result[0].parts) == 4
    assert "selection" in result[0].parts[0].text.lower()
    # Second message should be the original user message
    assert result[1].id == "msg-1"


def test_inject_document_state_messages_without_selection():
    """A user message with documentState but no selection should describe
    the full document context."""
    messages = [
        UIMessage(
            role="user",
            id="msg-1",
            parts=[TextUIPart(text="Summarize")],
            metadata={
                "documentState": {
                    "selection": None,
                    "blocks": [
                        {"type": "paragraph", "content": "Hello"},
                    ],
                    "isEmptyDocument": False,
                }
            },
        ),
    ]

    result = AIService.inject_document_state_messages(messages)

    assert len(result) == 2
    assistant_msg = result[0]
    assert assistant_msg.role == "assistant"
    assert len(assistant_msg.parts) == 2
    assert "no active selection" in assistant_msg.parts[0].text.lower()
    assert "prefer updating" in assistant_msg.parts[0].text.lower()


def test_inject_document_state_messages_empty_document():
    """When the document is empty, the injected message should instruct
    updating the empty block first."""
    messages = [
        UIMessage(
            role="user",
            id="msg-1",
            parts=[TextUIPart(text="Write something")],
            metadata={
                "documentState": {
                    "selection": None,
                    "blocks": [{"type": "paragraph", "content": ""}],
                    "isEmptyDocument": True,
                }
            },
        ),
    ]

    result = AIService.inject_document_state_messages(messages)

    assert len(result) == 2
    assistant_msg = result[0]
    assert "update the empty block" in assistant_msg.parts[0].text.lower()


def test_inject_document_state_messages_mixed():
    """Only user messages with documentState get assistant context;
    other messages pass through unchanged."""
    messages = [
        UIMessage(
            role="assistant",
            id="msg-0",
            parts=[TextUIPart(text="Previous response")],
        ),
        UIMessage(
            role="user",
            id="msg-1",
            parts=[TextUIPart(text="Hello")],
        ),
        UIMessage(
            role="user",
            id="msg-2",
            parts=[TextUIPart(text="Fix this")],
            metadata={
                "documentState": {
                    "selection": {"start": 0, "end": 5},
                    "selectedBlocks": [{"type": "paragraph", "content": "Hello"}],
                    "blocks": [{"type": "paragraph", "content": "Hello"}],
                }
            },
        ),
    ]

    result = AIService.inject_document_state_messages(messages)

    # 3 original + 1 injected assistant message before msg-2
    assert len(result) == 4
    assert result[0].id == "msg-0"
    assert result[1].id == "msg-1"
    assert result[2].role == "assistant"
    assert result[2].id == "assistant-document-state-msg-2"
    assert result[3].id == "msg-2"


# -- AIService.tool_definitions_to_toolset --


def test_tool_definitions_to_toolset():
    """Should convert frontend tool definitions to an ExternalToolset."""
    tool_definitions = {
        "applyOperations": {
            "description": "Apply operations to the document",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "operations": {"type": "array"},
                },
            },
            "outputSchema": {"type": "object"},
        },
        "insertBlocks": {
            "description": "Insert blocks",
            "inputSchema": {"type": "object"},
        },
    }

    toolset = AIService.tool_definitions_to_toolset(tool_definitions)

    # The ExternalToolset wraps ToolDefinition objects
    assert toolset is not None
    # Access internal tool definitions
    tool_defs = toolset.tool_defs
    assert len(tool_defs) == 2

    names = {td.name for td in tool_defs}
    assert names == {"applyOperations", "insertBlocks"}

    for td in tool_defs:
        assert td.kind == "external"
        if td.name == "applyOperations":
            assert td.description == "Apply operations to the document"
            assert td.metadata == {"output_schema": {"type": "object"}}


def test_tool_definitions_to_toolset_missing_fields():
    """Should handle tool definitions with missing optional fields."""
    tool_definitions = {
        "myTool": {},
    }

    toolset = AIService.tool_definitions_to_toolset(tool_definitions)

    tool_defs = toolset.tool_defs
    assert len(tool_defs) == 1
    assert tool_defs[0].name == "myTool"
    assert tool_defs[0].description == ""
    assert tool_defs[0].parameters_json_schema == {}
    assert tool_defs[0].metadata == {"output_schema": None}


# -- AIService.stream --


@patch.object(AIService, "_build_async_stream")
def test_services_ai_stream_sync_mode(mock_build, monkeypatch):
    """In sync mode, stream() should return a sync iterator."""

    async def mock_async_gen():
        yield "chunk1"
        yield "chunk2"

    mock_build.return_value = mock_async_gen()
    monkeypatch.setenv("PYTHON_SERVER_MODE", "sync")

    service = AIService()
    request = MagicMock()
    result = service.stream(request)

    # Should be a regular (sync) iterator, not async
    assert not isinstance(result, AsyncIterator)
    assert list(result) == ["chunk1", "chunk2"]
    mock_build.assert_called_once_with(request)


@patch.object(AIService, "_build_async_stream")
def test_services_ai_stream_async_mode(mock_build, monkeypatch):
    """In async mode, stream() should return the async iterator directly."""

    async def mock_async_gen():
        yield "chunk1"
        yield "chunk2"

    mock_async_iter = mock_async_gen()
    mock_build.return_value = mock_async_iter
    monkeypatch.setenv("PYTHON_SERVER_MODE", "async")

    service = AIService()
    request = MagicMock()
    result = service.stream(request)

    assert result is mock_async_iter
    mock_build.assert_called_once_with(request)


@patch.object(AIService, "_build_async_stream")
def test_services_ai_stream_defaults_to_sync(mock_build, monkeypatch):
    """When PYTHON_SERVER_MODE is not set, stream() should default to sync."""

    async def mock_async_gen():
        yield "data"

    mock_build.return_value = mock_async_gen()
    monkeypatch.delenv("PYTHON_SERVER_MODE", raising=False)

    service = AIService()
    request = MagicMock()
    result = service.stream(request)

    # Default should be sync mode
    assert not isinstance(result, AsyncIterator)
    assert list(result) == ["data"]


# -- AIService._build_async_stream --


@patch("core.services.ai_services.VercelAIAdapter")
def test_services_ai_build_async_stream(mock_adapter_cls):
    """_build_async_stream should build the pydantic-ai streaming pipeline."""

    async def mock_encode():
        yield "event-data"

    mock_run_input = MagicMock()
    mock_run_input.model_extra = None
    mock_run_input.messages = []
    mock_adapter_cls.build_run_input.return_value = mock_run_input

    mock_adapter_instance = MagicMock()
    mock_adapter_instance.run_stream.return_value = MagicMock()
    mock_adapter_instance.encode_stream.return_value = mock_encode()
    mock_adapter_cls.return_value = mock_adapter_instance

    service = AIService()
    request = MagicMock()
    request.META = {"HTTP_ACCEPT": "text/event-stream"}
    request.raw_body = b'{"messages": []}'

    result = service._build_async_stream(request)
    assert isinstance(result, AsyncIterator)
    mock_adapter_cls.build_run_input.assert_called_once_with(b'{"messages": []}')
    mock_adapter_instance.run_stream.assert_called_once()
    mock_adapter_instance.encode_stream.assert_called_once()


@patch("core.services.ai_services.VercelAIAdapter")
def test_services_ai_build_async_stream_with_tool_definitions(mock_adapter_cls):
    """_build_async_stream should build an ExternalToolset when
    toolDefinitions are present in the request."""

    async def mock_encode():
        yield "event-data"

    mock_run_input = MagicMock()
    mock_run_input.model_extra = {
        "toolDefinitions": {
            "myTool": {
                "description": "A tool",
                "inputSchema": {"type": "object"},
            }
        }
    }
    mock_run_input.messages = []
    mock_adapter_cls.build_run_input.return_value = mock_run_input

    mock_adapter_instance = MagicMock()
    mock_adapter_instance.run_stream.return_value = MagicMock()
    mock_adapter_instance.encode_stream.return_value = mock_encode()
    mock_adapter_cls.return_value = mock_adapter_instance

    service = AIService()
    request = MagicMock()
    request.META = {}
    request.raw_body = b"{}"

    service._build_async_stream(request)
    # run_stream should have been called with a toolset
    call_kwargs = mock_adapter_instance.run_stream.call_args[1]
    assert call_kwargs["toolsets"] is not None
    assert len(call_kwargs["toolsets"]) == 1


@patch("core.services.ai_services.VercelAIAdapter")
def test_services_ai_build_async_stream_with_tool_definitions_required_system_prompt(
    mock_adapter_cls,
):
    """The presence of the applyDocumentOperations tool must force the addition
    of a system prompt"""

    async def mock_encode():
        yield "event-data"

    mock_run_input = MagicMock()
    mock_run_input.model_extra = {
        "toolDefinitions": {
            "applyDocumentOperations": {
                "description": "A tool",
                "inputSchema": {"type": "object"},
            }
        }
    }
    mock_run_input.messages = []
    mock_adapter_cls.build_run_input.return_value = mock_run_input

    mock_adapter_instance = MagicMock()
    mock_adapter_instance.run_stream.return_value = MagicMock()
    mock_adapter_instance.encode_stream.return_value = mock_encode()
    mock_adapter_cls.return_value = mock_adapter_instance

    service = AIService()
    request = MagicMock()
    request.META = {}
    request.raw_body = b"{}"

    service._build_async_stream(request)
    # run_stream should have been called with a toolset
    call_kwargs = mock_adapter_instance.run_stream.call_args[1]
    assert call_kwargs["toolsets"] is not None
    assert len(call_kwargs["toolsets"]) == 1
    assert len(mock_run_input.messages) == 1
    assert mock_run_input.messages[0].id == "system-force-tool-usage"
    assert mock_run_input.messages[0].role == "system"
    assert mock_run_input.messages[0].parts[0].text == BLOCKNOTE_TOOL_STRICT_PROMPT


@patch("core.services.ai_services.Agent")
@patch("core.services.ai_services.VercelAIAdapter")
def test_services_ai_build_async_stream_langfuse_enabled(
    mock_adapter_cls, mock_agent_cls, settings
):
    """When LANGFUSE_PUBLIC_KEY is set, instrument should be enabled."""
    settings.LANGFUSE_PUBLIC_KEY = "pk-test-123"

    async def mock_encode():
        yield "data"

    mock_run_input = MagicMock()
    mock_run_input.model_extra = None
    mock_run_input.messages = []
    mock_adapter_cls.build_run_input.return_value = mock_run_input

    mock_adapter_instance = MagicMock()
    mock_adapter_instance.run_stream.return_value = MagicMock()
    mock_adapter_instance.encode_stream.return_value = mock_encode()
    mock_adapter_cls.return_value = mock_adapter_instance

    service = AIService()
    request = MagicMock()
    request.META = {}
    request.raw_body = b"{}"

    service._build_async_stream(request)
    mock_agent_cls.instrument_all.assert_called_once()
    # Agent should be created with instrument=True
    mock_agent_cls.assert_called_once()
    assert mock_agent_cls.call_args[1]["instrument"] is True
