"""
Test AI API endpoints in the impress core app.
"""

import json
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
        AIService().transform("hello", "prompt")


@override_settings(
    AI_BASE_URL="http://example.com", AI_API_KEY="test-key", AI_MODEL="test-model"
)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_ai__client_invalid_response(mock_create):
    """Fail when the client response is invalid"""

    answer = {"no_answer": "This is an invalid response"}
    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=json.dumps(answer)))]
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
def test_api_ai__success(mock_create):
    """The AI request should work as expect when called with valid arguments."""

    answer = '{"answer": "Salut"}'
    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=answer))]
    )

    response = AIService().transform("hello", "prompt")

    assert response == {"answer": "Salut"}


@override_settings(
    AI_BASE_URL="http://example.com", AI_API_KEY="test-key", AI_MODEL="test-model"
)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_ai__success_sanitize(mock_create):
    """The AI response should be sanitized"""

    answer = '{"answer": "Salut\\n \tle \nmonde"}'
    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=answer))]
    )

    response = AIService().transform("hello", "prompt")

    assert response == {"answer": "Salut\n \tle \nmonde"}


@override_settings(
    AI_BASE_URL="http://example.com", AI_API_KEY="test-key", AI_MODEL="test-model"
)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_ai__success_when_sanitize_fails(mock_create):
    """The AI request should work as expected even with badly formatted response."""

    # pylint: disable=C0303
    answer = """{ 
        "answer"        :       
        "Salut le monde"
    }"""
    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=answer))]
    )

    response = AIService().transform("hello", "prompt")

    assert response == {"answer": "Salut le monde"}
