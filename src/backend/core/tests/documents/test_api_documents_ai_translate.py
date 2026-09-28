"""
Test AI translate API endpoint for users in impress's core app.
"""

from unittest import mock
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser

import pytest
from rest_framework.test import APIClient

from core import factories
from core.services.ai_services.legacy import get_legacy_ai_service
from core.tests.conftest import TEAM, USER, VIA
from core.utils.analytics import PosthogEventName

pytestmark = pytest.mark.django_db


@pytest.fixture
def ai_settings(settings):
    """Fixture to set AI settings."""
    settings.AI_FEATURE_ENABLED = True
    settings.AI_FEATURE_LEGACY_ENABLED = True
    settings.OPENAI_SDK_BASE_URL = "http://example.com"
    settings.OPENAI_SDK_API_KEY = "test-key"
    settings.AI_MODEL = "llama"


@pytest.fixture(autouse=True)
def clear_openai_client_config():
    "clear the configure_legacy_openai_client cache"
    get_legacy_ai_service.cache_clear()


def test_api_documents_ai_translate_viewset_options_metadata():
    """The documents endpoint should give us the list of available languages."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory(link_reach="public", link_role="editor")

    response = APIClient().options("/api/v1.0/documents/")

    assert response.status_code == 200
    metadata = response.json()
    assert metadata["name"] == "Document List"
    assert metadata["actions"]["POST"]["language"]["choices"][0] == {
        "value": "af",
        "display_name": "Afrikaans",
    }


@pytest.mark.parametrize(
    "reach, role, ai_allow_reach_from",
    [
        ("restricted", "reader", "public"),
        ("restricted", "reader", "authenticated"),
        ("restricted", "reader", "restricted"),
        ("restricted", "editor", "public"),
        ("restricted", "editor", "authenticated"),
        ("restricted", "editor", "restricted"),
        ("authenticated", "reader", "public"),
        ("authenticated", "reader", "authenticated"),
        ("authenticated", "reader", "restricted"),
        ("authenticated", "editor", "public"),
        ("authenticated", "editor", "authenticated"),
        ("authenticated", "editor", "restricted"),
        ("public", "reader", "public"),
        ("public", "reader", "authenticated"),
        ("public", "reader", "restricted"),
    ],
)
def test_api_documents_ai_translate_anonymous_forbidden(
    reach, role, ai_allow_reach_from, settings
):
    """
    Anonymous users should not be able to request AI translate if the link reach
    and role don't allow it.
    """
    settings.AI_ALLOW_REACH_FROM = ai_allow_reach_from
    document = factories.DocumentFactory(link_reach=reach, link_role=role)

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    response = APIClient().post(url, {"text": "hello", "language": "es"})

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.usefixtures("ai_settings")
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_translate_anonymous_success(mock_create, settings):
    """
    Anonymous users should be able to request AI translate to a document
    if the link reach and role permit it.
    """
    settings.AI_ALLOW_REACH_FROM = "public"
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Ola"))]
    )

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = APIClient().post(url, {"text": "Hello", "language": "es"})

    assert response.status_code == 200
    assert response.json() == {"answer": "Ola"}
    mock_create.assert_called_once_with(
        model="llama",
        messages=[
            {
                "role": "system",
                "content": (
                    "Keep the same html structure and formatting. "
                    "Translate the content in the html to the specified language Spanish. "
                    "Check the translation for accuracy and make any necessary corrections. "
                    "Do not provide any other information. "
                    "Return the content directly without wrapping it in code blocks or markdown "
                    "delimiters."
                ),
            },
            {"role": "user", "content": "Hello"},
        ],
    )

    # The AI action should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_AI_ACTION,
        AnonymousUser(),
        {"method": "ai_translate", "language": "es"},
        document=document,
    )


@pytest.mark.usefixtures("ai_settings")
@pytest.mark.parametrize("ai_allow_reach_from", ["authenticated", "restricted"])
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_translate_anonymous_limited_by_setting(
    mock_create, ai_allow_reach_from, settings
):
    """
    Anonymous users should be able to request AI translate to a document
    if the link reach and role permit it.
    """
    settings.AI_ALLOW_REACH_FROM = ai_allow_reach_from
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    answer = '{"answer": "Salut"}'
    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=answer))]
    )

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    response = APIClient().post(url, {"text": "Hello", "language": "es"})

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
def test_api_documents_ai_translate_authenticated_forbidden(reach, role):
    """
    Users who are not related to a document can't request AI translate if the
    link reach and role don't allow it.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    response = client.post(url, {"text": "Hello", "language": "es"})

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize(
    "reach, role",
    [
        ("authenticated", "editor"),
        ("public", "editor"),
    ],
)
@pytest.mark.usefixtures("ai_settings")
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_translate_authenticated_success(mock_create, reach, role):
    """
    Authenticated who are not related to a document should be able to request AI translate
    if the link reach and role permit it.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Salut"))]
    )

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(url, {"text": "Hello", "language": "es-co"})

    assert response.status_code == 200
    assert response.json() == {"answer": "Salut"}
    mock_create.assert_called_once_with(
        model="llama",
        messages=[
            {
                "role": "system",
                "content": (
                    "Keep the same html structure and formatting. "
                    "Translate the content in the html to the "
                    "specified language Colombian Spanish. "
                    "Check the translation for accuracy and make any necessary corrections. "
                    "Do not provide any other information. "
                    "Return the content directly without wrapping it in code blocks or markdown "
                    "delimiters."
                ),
            },
            {"role": "user", "content": "Hello"},
        ],
    )

    # The AI action should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_AI_ACTION,
        user,
        {"method": "ai_translate", "language": "es-co"},
        document=document,
    )


@pytest.mark.parametrize("via", VIA)
def test_api_documents_ai_translate_reader(via, mock_user_teams):
    """
    Users who are simple readers on a document should not be allowed to request AI translate.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_role="reader")
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role="reader")
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="reader"
        )

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    response = client.post(url, {"text": "Hello", "language": "es"})

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
@pytest.mark.usefixtures("ai_settings")
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_translate_success(mock_create, via, role, mock_user_teams):
    """
    Editors, administrators and owners of a document should be able to request AI translate.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Salut"))]
    )

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(url, {"text": "Hello", "language": "es-co"})

    assert response.status_code == 200
    assert response.json() == {"answer": "Salut"}
    mock_create.assert_called_once_with(
        model="llama",
        messages=[
            {
                "role": "system",
                "content": (
                    "Keep the same html structure and formatting. "
                    "Translate the content in the html to the "
                    "specified language Colombian Spanish. "
                    "Check the translation for accuracy and make any necessary corrections. "
                    "Do not provide any other information. "
                    "Return the content directly without wrapping it in code blocks or markdown "
                    "delimiters."
                ),
            },
            {"role": "user", "content": "Hello"},
        ],
    )

    # The AI action should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_AI_ACTION,
        user,
        {"method": "ai_translate", "language": "es-co"},
        document=document,
    )


@pytest.mark.usefixtures("ai_settings")
def test_api_documents_ai_translate_empty_text():
    """The text should not be empty when requesting AI translate."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    response = client.post(url, {"text": " ", "language": "es"})

    assert response.status_code == 400
    assert response.json() == {"text": ["This field may not be blank."]}


@pytest.mark.usefixtures("ai_settings")
def test_api_documents_ai_translate_invalid_action():
    """The action should valid when requesting AI translate."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    response = client.post(url, {"text": "Hello", "language": "invalid"})

    assert response.status_code == 400
    assert response.json() == {"language": ['"invalid" is not a valid choice.']}


@pytest.mark.usefixtures("ai_settings")
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_translate_throttling_document(mock_create, settings):
    """
    Throttling per document should be triggered on the AI translate endpoint.
    For full throttle class test see: `test_api_utils_ai_document_rate_throttles`
    """
    settings.AI_DOCUMENT_RATE_THROTTLE_RATES = {"minute": 3, "hour": 6, "day": 10}
    client = APIClient()
    document = factories.DocumentFactory(link_reach="public", link_role="editor")

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Salut"))]
    )

    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    for _ in range(3):
        user = factories.UserFactory()
        client.force_login(user)
        response = client.post(url, {"text": "Hello", "language": "es"})
        assert response.status_code == 200
        assert response.json() == {"answer": "Salut"}

    user = factories.UserFactory()
    client.force_login(user)
    response = client.post(url, {"text": "Hello", "language": "es"})

    assert response.status_code == 429
    assert response.json() == {
        "detail": "Request was throttled. Expected available in 60 seconds."
    }


@pytest.mark.usefixtures("ai_settings")
@patch("openai.resources.chat.completions.Completions.create")
def test_api_documents_ai_translate_throttling_user(mock_create, settings):
    """
    Throttling per user should be triggered on the AI translate endpoint.
    For full throttle class test see: `test_api_utils_ai_user_rate_throttles`
    """
    settings.AI_USER_RATE_THROTTLE_RATES = {"minute": 3, "hour": 6, "day": 10}
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    mock_create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Salut"))]
    )

    for _ in range(3):
        document = factories.DocumentFactory(link_reach="public", link_role="editor")
        url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
        response = client.post(url, {"text": "Hello", "language": "es"})
        assert response.status_code == 200
        assert response.json() == {"answer": "Salut"}

    document = factories.DocumentFactory(link_reach="public", link_role="editor")
    url = f"/api/v1.0/documents/{document.id!s}/ai-translate/"
    response = client.post(url, {"text": "Hello", "language": "es"})

    assert response.status_code == 429
    assert response.json() == {
        "detail": "Request was throttled. Expected available in 60 seconds."
    }
