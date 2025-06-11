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


@pytest.mark.parametrize(
    "setting_name, setting_value",
    [
        ("AI_BASE_URL", None),
        ("AI_API_KEY", None),
        ("AI_MODEL", None),
    ],
)
def test_api_ai_setting_missing(setting_name, setting_value):
    """Setting should be set"""

    with override_settings(**{setting_name: setting_value}):
        with pytest.raises(
            ImproperlyConfigured,
            match="AI configuration not set",
        ):
            AIService()


@override_settings(
    AI_BASE_URL="http://example.com", AI_API_KEY="test-key", AI_MODEL="test-model"
)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_ai__client_error(mock_create):
    """Fail when the client raises an error"""

    mock_create.side_effect = OpenAIError("Mocked client error")

    with pytest.raises(
        OpenAIError,
        match="Mocked client error",
    ):
        AIService().proxy({"messages": [{"role": "user", "content": "hello"}]})


@override_settings(
    AI_BASE_URL="http://example.com", AI_API_KEY="test-key", AI_MODEL="test-model"
)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_ai__success(mock_create):
    """The AI request should work as expect when called with valid arguments."""

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {
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
    mock_create.return_value = mock_response

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
