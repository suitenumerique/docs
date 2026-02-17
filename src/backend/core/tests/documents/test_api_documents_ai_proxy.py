"""
Test AI proxy API endpoint for users in impress's core app.
"""

import random
from unittest.mock import patch

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def ai_settings(settings):
    """Fixture to set AI settings."""
    settings.AI_MODEL = "llama"
    settings.AI_BASE_URL = "http://localhost-ai:12345/"
    settings.AI_API_KEY = "test-key"
    settings.AI_FEATURE_ENABLED = True
    settings.LANGFUSE_PUBLIC_KEY = None
    settings.AI_VERCEL_SDK_VERSION = 6


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
        },
        format="json",
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@override_settings(AI_ALLOW_REACH_FROM="public")
@patch("core.services.ai_services.AIService.stream")
def test_api_documents_ai_proxy_anonymous_success(mock_stream):
    """
    Anonymous users should be able to request AI proxy to a document
    if the link reach and role permit it.
    """
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_stream.return_value = iter(["data: chunk1\n", "data: chunk2\n"])

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = APIClient().post(
        url,
        b"{}",
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "text/event-stream"
    assert response["x-vercel-ai-data-stream"] == "v1"
    assert response["X-Accel-Buffering"] == "no"

    content = b"".join(response.streaming_content).decode()
    assert "chunk1" in content
    assert "chunk2" in content
    mock_stream.assert_called_once()


@override_settings(AI_ALLOW_REACH_FROM=random.choice(["authenticated", "restricted"]))
def test_api_documents_ai_proxy_anonymous_limited_by_setting():
    """
    Anonymous users should not be able to request AI proxy to a document
    if AI_ALLOW_REACH_FROM setting restricts it.
    """
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = APIClient().post(
        url,
        b"{}",
        content_type="application/json",
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
        b"{}",
        content_type="application/json",
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    "reach, role",
    [
        ("authenticated", "editor"),
        ("public", "editor"),
    ],
)
@patch("core.services.ai_services.AIService.stream")
def test_api_documents_ai_proxy_authenticated_success(mock_stream, reach, role):
    """
    Authenticated users should be able to request AI proxy to a document
    if the link reach and role permit it.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)

    mock_stream.return_value = iter(["data: response\n"])

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        b"{}",
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "text/event-stream"
    mock_stream.assert_called_once()


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
        b"{}",
        content_type="application/json",
    )

    assert response.status_code == 403


@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
@patch("core.services.ai_services.AIService.stream")
def test_api_documents_ai_proxy_success(mock_stream, via, role, mock_user_teams):
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

    mock_stream.return_value = iter(["data: success\n"])

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        b"{}",
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "text/event-stream"
    assert response["x-vercel-ai-data-stream"] == "v1"
    assert response["X-Accel-Buffering"] == "no"

    content = b"".join(response.streaming_content).decode()
    assert "success" in content
    mock_stream.assert_called_once()


def test_api_documents_ai_proxy_ai_feature_disabled(settings):
    """When AI_FEATURE_ENABLED is False, the endpoint returns 400."""
    settings.AI_FEATURE_ENABLED = False

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/ai-proxy/",
        b"{}",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json() == ["AI feature is not enabled."]


@override_settings(AI_DOCUMENT_RATE_THROTTLE_RATES={"minute": 3, "hour": 6, "day": 10})
@patch("core.services.ai_services.AIService.stream")
def test_api_documents_ai_proxy_throttling_document(mock_stream):
    """
    Throttling per document should be triggered on the AI proxy endpoint.
    For full throttle class test see: `test_api_utils_ai_document_rate_throttles`
    """
    client = APIClient()
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_stream.return_value = iter(["data: ok\n"])

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    for _ in range(3):
        mock_stream.return_value = iter(["data: ok\n"])
        user = factories.UserFactory()
        client.force_login(user)
        response = client.post(
            url,
            b"{}",
            content_type="application/json",
        )
        assert response.status_code == 200

    user = factories.UserFactory()
    client.force_login(user)
    response = client.post(
        url,
        b"{}",
        content_type="application/json",
    )

    assert response.status_code == 429
    assert response.json() == {
        "detail": "Request was throttled. Expected available in 60 seconds."
    }


@override_settings(AI_USER_RATE_THROTTLE_RATES={"minute": 3, "hour": 6, "day": 10})
@patch("core.services.ai_services.AIService.stream")
def test_api_documents_ai_proxy_throttling_user(mock_stream):
    """
    Throttling per user should be triggered on the AI proxy endpoint.
    For full throttle class test see: `test_api_utils_ai_user_rate_throttles`
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    for _ in range(3):
        mock_stream.return_value = iter(["data: ok\n"])
        document = factories.DocumentFactory(link_reach="public", link_role="editor")
        url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
        response = client.post(
            url,
            b"{}",
            content_type="application/json",
        )
        assert response.status_code == 200

    document = factories.DocumentFactory(link_reach="public", link_role="editor")
    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        b"{}",
        content_type="application/json",
    )

    assert response.status_code == 429
    assert response.json() == {
        "detail": "Request was throttled. Expected available in 60 seconds."
    }


@patch("core.services.ai_services.AIService.stream")
def test_api_documents_ai_proxy_returns_streaming_response(mock_stream):
    """AI proxy should return a StreamingHttpResponse with correct headers."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_stream.return_value = iter(["data: part1\n", "data: part2\n", "data: part3\n"])

    url = f"/api/v1.0/documents/{document.id!s}/ai-proxy/"
    response = client.post(
        url,
        b"{}",
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "text/event-stream"
    assert response["x-vercel-ai-data-stream"] == "v1"
    assert response["X-Accel-Buffering"] == "no"

    chunks = list(response.streaming_content)
    assert len(chunks) == 3


def test_api_documents_ai_proxy_invalid_payload():
    """AI Proxy should return a 400 if the payload is invalid."""

    user = factories.UserFactory()

    document = factories.DocumentFactory(users=[(user, "owner")])

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/ai-proxy/",
        b'{"foo": "bar", "trigger": "submit-message"}',
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid submitted payload"}
