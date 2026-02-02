"""
Test AI proxy API endpoint for users in impress's core app.
"""

import random
from unittest.mock import MagicMock, patch

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories
from core.services.ai_services import BLOCKNOTE_TOOL_STRICT_PROMPT
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def ai_settings(settings):
    """Fixture to set AI settings."""
    settings.AI_MODEL = "llama"
    settings.AI_BASE_URL = "http://localhost-ai:12345/"
    settings.AI_API_KEY = "test-key"
    settings.AI_FEATURE_ENABLED = True


@override_settings(
    AI_ALLOW_REACH_FROM=random.choice(["public", "authenticated", "restricted"])
)
@pytest.mark.parametrize(
    "reach, role",
    [
        ("restricted", "reader"),
        ("restricted", "editor"),
        ("authenticated", "reader"),
        ("authenticated", "editor"),
        ("public", "reader"),
    ],
)
def test_api_documents_ai_proxy_anonymous_forbidden(reach, role):
    """
    Anonymous users should not be able to request AI proxy if the link reach
    and role don't allow it.
    """
    document = factories.DocumentFactory(link_reach=reach, link_role=role)

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = APIClient().post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@override_settings(AI_ALLOW_REACH_FROM="public", AI_STREAM=False)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_anonymous_success(mock_create):
    """
    Anonymous users should be able to request AI proxy to a document
    if the link reach and role permit it.
    """
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "created": 1677652288,
        "model": "llama",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Hello! How can I help you?",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 9, "completion_tokens": 12, "total_tokens": 21},
    }
    mock_create.return_value = mock_response
    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = APIClient().post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["id"] == "chatcmpl-123"
    assert response_data["model"] == "llama"
    assert len(response_data["choices"]) == 1
    assert (
        response_data["choices"][0]["message"]["content"]
        == "Hello! How can I help you?"
    )

    mock_create.assert_called_once_with(
        messages=[
            {"role": "system", "content": BLOCKNOTE_TOOL_STRICT_PROMPT},
            {"role": "user", "content": "Hello"},
        ],
        model="llama",
        stream=False,
    )


@override_settings(AI_ALLOW_REACH_FROM=random.choice(["authenticated", "restricted"]))
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_anonymous_limited_by_setting(mock_create):
    """
    Anonymous users should not be able to request AI proxy to a document
    if AI_ALLOW_REACH_FROM setting restricts it.
    """
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {"content": "Hello!"}
    mock_create.return_value = mock_response

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = APIClient().post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 401


@pytest.mark.parametrize(
    "reach, role",
    [
        ("restricted", "reader"),
        ("restricted", "editor"),
        ("authenticated", "reader"),
        ("public", "reader"),
    ],
)
def test_api_documents_ai_proxy_authenticated_forbidden(reach, role):
    """
    Users who are not related to a document can't request AI proxy if the
    link reach and role don't allow it.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    "reach, role",
    [
        ("authenticated", "editor"),
        ("public", "editor"),
    ],
)
@override_settings(AI_STREAM=False)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_authenticated_success(mock_create, reach, role):
    """
    Authenticated users should be able to request AI proxy to a document
    if the link reach and role permit it.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {
        "id": "chatcmpl-456",
        "object": "chat.completion",
        "model": "llama",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Hi there!"},
                "finish_reason": "stop",
            }
        ],
    }
    mock_create.return_value = mock_response

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["id"] == "chatcmpl-456"
    assert response_data["choices"][0]["message"]["content"] == "Hi there!"

    mock_create.assert_called_once_with(
        messages=[
            {"role": "system", "content": BLOCKNOTE_TOOL_STRICT_PROMPT},
            {"role": "user", "content": "Hello"},
        ],
        model="llama",
        stream=False,
    )


@pytest.mark.parametrize("via", VIA)
def test_api_documents_ai_proxy_reader(via, mock_user_teams):
    """Users with reader access should not be able to request AI proxy."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role="reader")
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="reader"
        )

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
@override_settings(AI_STREAM=False)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_success(mock_create, via, role, mock_user_teams):
    """Users with sufficient permissions should be able to request AI proxy."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {
        "id": "chatcmpl-789",
        "object": "chat.completion",
        "model": "llama",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Success!"},
                "finish_reason": "stop",
            }
        ],
    }
    mock_create.return_value = mock_response

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        {
            "messages": [{"role": "user", "content": "Test message"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["id"] == "chatcmpl-789"
    assert response_data["choices"][0]["message"]["content"] == "Success!"

    mock_create.assert_called_once_with(
        messages=[
            {"role": "system", "content": BLOCKNOTE_TOOL_STRICT_PROMPT},
            {"role": "user", "content": "Test message"},
        ],
        model="llama",
        stream=False,
    )


def test_api_documents_ai_proxy_empty_messages():
    """The messages should not be empty when requesting AI proxy."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(url, {"messages": [], "model": "llama"}, format="json")

    assert response.status_code == 400
    assert response.json() == {"messages": ["This list may not be empty."]}


def test_api_documents_ai_proxy_missing_model():
    """The model should be required when requesting AI proxy."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url, {"messages": [{"role": "user", "content": "Hello"}]}, format="json"
    )

    assert response.status_code == 400
    assert response.json() == {"model": ["This field is required."]}


def test_api_documents_ai_proxy_invalid_message_format():
    """Messages should have the correct format when requesting AI proxy."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"

    # Test with invalid message format (missing role)
    response = client.post(
        url,
        {
            "messages": [{"content": "Hello"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "messages": ["Each message must have 'role' and 'content' fields"]
    }

    # Test with invalid message format (missing content)
    response = client.post(
        url,
        {
            "messages": [{"role": "user"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "messages": ["Each message must have 'role' and 'content' fields"]
    }

    # Test with non-dict message
    response = client.post(
        url,
        {
            "messages": ["invalid"],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "messages": {"0": ['Expected a dictionary of items but got type "str".']}
    }


@override_settings(AI_STREAM=False)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_stream_disabled(mock_create):
    """Stream should be automatically disabled in AI proxy requests."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {"content": "Success!"}
    mock_create.return_value = mock_response

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
            "stream": True,  # This should be overridden to False
        },
        format="json",
    )

    assert response.status_code == 200
    # Verify that stream was set to False
    mock_create.assert_called_once_with(
        messages=[
            {"role": "system", "content": BLOCKNOTE_TOOL_STRICT_PROMPT},
            {"role": "user", "content": "Hello"},
        ],
        model="llama",
        stream=False,
    )


@override_settings(AI_STREAM=False)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_additional_parameters(mock_create):
    """AI proxy should pass through additional parameters to the AI service."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {"content": "Success!"}
    mock_create.return_value = mock_response

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
            "temperature": 0.7,
            "max_tokens": 100,
            "top_p": 0.9,
        },
        format="json",
    )

    assert response.status_code == 200
    # Verify that additional parameters were passed through
    mock_create.assert_called_once_with(
        messages=[
            {"role": "system", "content": BLOCKNOTE_TOOL_STRICT_PROMPT},
            {"role": "user", "content": "Hello"},
        ],
        model="llama",
        temperature=0.7,
        max_tokens=100,
        top_p=0.9,
        stream=False,
    )


@override_settings(AI_STREAM=False)
@override_settings(AI_DOCUMENT_RATE_THROTTLE_RATES={"minute": 3, "hour": 6, "day": 10})
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_throttling_document(mock_create):
    """
    Throttling per document should be triggered on the AI transform endpoint.
    For full throttle class test see: `test_api_utils_ai_document_rate_throttles`
    """
    client = APIClient()
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {"content": "Success!"}
    mock_create.return_value = mock_response

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    for _ in range(3):
        user = factories.UserFactory()
        client.force_login(user)
        response = client.post(
            url,
            {
                "messages": [{"role": "user", "content": "Test message"}],
                "model": "llama",
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.json() == {"content": "Success!"}

    user = factories.UserFactory()
    client.force_login(user)
    response = client.post(
        url,
        {
            "messages": [{"role": "user", "content": "Test message"}],
            "model": "llama",
        },
    )

    assert response.status_code == 429
    assert response.json() == {
        "detail": "Request was throttled. Expected available in 60 seconds."
    }


@override_settings(AI_STREAM=False)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_complex_conversation(mock_create):
    """AI proxy should handle complex conversations with multiple messages."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {
        "id": "chatcmpl-complex",
        "object": "chat.completion",
        "model": "llama",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "I understand your question about Python.",
                },
                "finish_reason": "stop",
            }
        ],
    }
    mock_create.return_value = mock_response

    complex_messages = [
        {"role": "system", "content": BLOCKNOTE_TOOL_STRICT_PROMPT},
        {"role": "system", "content": "You are a helpful programming assistant."},
        {"role": "user", "content": "How do I write a for loop in Python?"},
        {
            "role": "assistant",
            "content": "You can write a for loop using: for item in iterable:",
        },
        {"role": "user", "content": "Can you give me a concrete example?"},
    ]

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        {
            "messages": complex_messages,
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["id"] == "chatcmpl-complex"
    assert (
        response_data["choices"][0]["message"]["content"]
        == "I understand your question about Python."
    )

    mock_create.assert_called_once_with(
        messages=complex_messages,
        model="llama",
        stream=False,
    )


@override_settings(AI_USER_RATE_THROTTLE_RATES={"minute": 3, "hour": 6, "day": 10})
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_throttling_user(mock_create):
    """
    Throttling per user should be triggered on the AI proxy endpoint.
    For full throttle class test see: `test_api_utils_ai_user_rate_throttles`
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {"content": "Success!"}
    mock_create.return_value = mock_response

    for _ in range(3):
        document = factories.DocumentFactory(link_reach="public", link_role="editor")
        url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
        response = client.post(
            url,
            {
                "messages": [{"role": "user", "content": "Hello"}],
                "model": "llama",
            },
            format="json",
        )
        assert response.status_code == 200

    document = factories.DocumentFactory(link_reach="public", link_role="editor")
    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 429
    assert response.json() == {
        "detail": "Request was throttled. Expected available in 60 seconds."
    }


@override_settings(AI_USER_RATE_THROTTLE_RATES={"minute": 10, "hour": 6, "day": 10})
def test_api_documents_ai_proxy_different_models():
    """AI proxy should work with different AI models."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    models_to_test = ["gpt-3.5-turbo", "gpt-4", "claude-3", "llama-2"]

    for model_name in models_to_test:
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/ai-proxy/",
            {
                "messages": [{"role": "user", "content": "Hello"}],
                "model": model_name,
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.json() == {"model": [f"{model_name} is not a valid model"]}


def test_api_documents_ai_proxy_ai_feature_disabled(settings):
    """When the settings AI_FEATURE_ENABLED is set to False, the endpoint is not reachable."""
    settings.AI_FEATURE_ENABLED = False

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/ai-proxy/",
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == ["AI feature is not enabled."]


@override_settings(AI_STREAM=False)
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_proxy_harden_payload(mock_create):
    """
    AI proxy should harden the payload by default:
    - it will remove stream_options if stream is False
    - normalize tools by adding descriptions if missing
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_response = MagicMock()
    mock_response.model_dump.return_value = {
        "id": "chatcmpl-789",
        "object": "chat.completion",
        "model": "llama",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Success!"},
                "finish_reason": "stop",
            }
        ],
    }
    mock_create.return_value = mock_response

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "llama",
            "stream": False,
            "stream_options": {"include_usage": True},
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "applyDocumentOperations",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "operations": {"type": "array", "items": {"anyOf": []}}
                            },
                            "additionalProperties": False,
                            "required": ["operations"],
                        },
                    },
                }
            ],
        },
        format="json",
    )

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["id"] == "chatcmpl-789"
    assert response_data["choices"][0]["message"]["content"] == "Success!"

    mock_create.assert_called_once_with(
        messages=[
            {"role": "system", "content": BLOCKNOTE_TOOL_STRICT_PROMPT},
            {"role": "user", "content": "Hello"},
        ],
        model="llama",
        stream=False,
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "applyDocumentOperations",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "operations": {"type": "array", "items": {"anyOf": []}}
                        },
                        "additionalProperties": False,
                        "required": ["operations"],
                    },
                    "description": "Tool applyDocumentOperations.",
                },
            }
        ],
    )
