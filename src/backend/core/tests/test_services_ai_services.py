"""
Test ai API endpoints in the impress core app.
"""

from unittest.mock import MagicMock, patch

from django.core.exceptions import ImproperlyConfigured
from django.test.utils import override_settings

import pytest
from openai import OpenAIError

from core.services.ai_services import AIService

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def ai_settings(settings):
    """Fixture to set AI settings."""
    settings.AI_MODEL = "llama"
    settings.AI_BASE_URL = "http://example.com"
    settings.AI_API_KEY = "test-key"
    settings.AI_FEATURE_ENABLED = True


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


@patch("openai.resources.chat.completions.Completions.create")
def test_services_ai_proxy_client_error(mock_create):
    """Fail when the client raises an error"""

    mock_create.side_effect = OpenAIError("Mocked client error")

    with pytest.raises(
        RuntimeError,
        match="Failed to proxy AI request: Mocked client error",
    ):
        AIService().proxy({"messages": [{"role": "user", "content": "hello"}]})


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


@patch("openai.resources.chat.completions.Completions.create")
def test_services_ai_proxy_success(mock_create):
    """The AI request should work as expect when called with valid arguments."""

    mock_create.return_value = {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 1234567890,
        "model": "test-model",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Salut"},
                "finish_reason": "stop",
            }
        ],
    }

    response = AIService().proxy({"messages": [{"role": "user", "content": "hello"}]})

    expected_response = {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 1234567890,
        "model": "test-model",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Salut"},
                "finish_reason": "stop",
            }
        ],
    }
    assert response == expected_response
    mock_create.assert_called_once_with(
        messages=[{"role": "user", "content": "hello"}], stream=False
    )


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


@patch("openai.resources.chat.completions.Completions.create")
def test_services_ai_proxy_with_stream(mock_create):
    """The AI request should work as expect when called with valid arguments."""

    mock_create.return_value = {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 1234567890,
        "model": "test-model",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Salut"},
                "finish_reason": "stop",
            }
        ],
    }

    response = AIService().proxy(
        {"messages": [{"role": "user", "content": "hello"}]}, stream=True
    )

    expected_response = {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 1234567890,
        "model": "test-model",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Salut"},
                "finish_reason": "stop",
            }
        ],
    }
    assert response == expected_response
    mock_create.assert_called_once_with(
        messages=[{"role": "user", "content": "hello"}], stream=True
    )
