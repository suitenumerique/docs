"""
Server-side features that need the plaintext of a document (comments, AI,
conversion, duplication) are refused on encrypted documents, even for users
who would be allowed to use them on a plain document.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


@pytest.fixture(name="ai_settings")
def fixture_ai_settings(settings):
    """Enable every AI feature so that only the encryption can refuse the request."""
    settings.AI_FEATURE_ENABLED = True
    settings.AI_FEATURE_BLOCKNOTE_ENABLED = True
    settings.AI_FEATURE_LEGACY_ENABLED = True
    settings.AI_ALLOW_REACH_FROM = "restricted"
    settings.AI_MODEL = "llama"
    settings.OPENAI_SDK_BASE_URL = "http://localhost-ai:12345/"
    settings.OPENAI_SDK_API_KEY = "test-key"


def _owner_client(is_encrypted):
    """Return a client logged in as the owner of a new document, and the document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        users=[(user, models.RoleChoices.OWNER)],
        is_encrypted=is_encrypted,
    )
    client = APIClient()
    client.force_login(user)
    return client, user, document


@pytest.mark.parametrize(
    "ability",
    [
        "ai_proxy",
        "ai_transform",
        "ai_translate",
        "comment",
        "duplicate",
        "formatted_content",
    ],
)
@pytest.mark.usefixtures("ai_settings")
def test_api_documents_encrypted_abilities_plaintext_features(ability):
    """The plaintext features are granted on a plain document and refused once encrypted."""
    _client, user, plain_document = _owner_client(is_encrypted=False)
    encrypted_document = factories.DocumentFactory(
        link_reach="restricted",
        users=[(user, models.RoleChoices.OWNER)],
        is_encrypted=True,
    )

    assert plain_document.get_abilities(user)[ability] is True
    assert encrypted_document.get_abilities(user)[ability] is False


def test_api_documents_encrypted_abilities_encryption_management():
    """Owners keep the right to manage the encryption of an encrypted document."""
    _client, user, document = _owner_client(is_encrypted=True)

    abilities = document.get_abilities(user)

    assert abilities["encrypt"] is True
    assert abilities["remove_encryption"] is True
    assert abilities["content_patch"] is True
    assert abilities["content_retrieve"] is True


def test_api_documents_encrypted_threads_create_refused():
    """Threads cannot be created on an encrypted document."""
    client, _user, document = _owner_client(is_encrypted=True)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/", {"body": "test"}
    )

    assert response.status_code == 403
    assert not models.Thread.objects.filter(document=document).exists()


def test_api_documents_encrypted_threads_list_refused():
    """Threads of an encrypted document cannot be listed."""
    client, _user, document = _owner_client(is_encrypted=True)
    factories.ThreadFactory(document=document)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/threads/")

    assert response.status_code == 403


def test_api_documents_encrypted_comments_create_refused():
    """Comments cannot be added to a thread of an encrypted document."""
    client, _user, document = _owner_client(is_encrypted=True)
    thread = factories.ThreadFactory(document=document)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/",
        {"body": "test"},
    )

    assert response.status_code == 403
    assert not models.Comment.objects.filter(thread=thread).exists()


def test_api_documents_encrypted_comments_list_refused():
    """Comments of a thread of an encrypted document cannot be listed."""
    client, _user, document = _owner_client(is_encrypted=True)
    thread = factories.ThreadFactory(document=document)
    factories.CommentFactory(thread=thread)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/"
    )

    assert response.status_code == 403


def test_api_documents_encrypted_duplicate_refused():
    """An encrypted document cannot be duplicated, its content is ciphertext."""
    client, _user, document = _owner_client(is_encrypted=True)

    response = client.post(f"/api/v1.0/documents/{document.id!s}/duplicate/")

    assert response.status_code == 403
    assert models.Document.objects.count() == 1


def test_api_documents_encrypted_formatted_content_refused():
    """An encrypted document cannot be converted server-side."""
    client, _user, document = _owner_client(is_encrypted=True)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/formatted-content/",
        {"content_format": "markdown"},
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    "url_path, payload",
    [
        ("ai-proxy", {"messages": [{"role": "user", "content": "Hello"}]}),
        ("ai-transform", {"text": "Hello", "action": "prompt"}),
        ("ai-translate", {"text": "Hello", "language": "es"}),
    ],
)
@pytest.mark.usefixtures("ai_settings")
def test_api_documents_encrypted_ai_refused(url_path, payload):
    """AI features are refused on an encrypted document, even when enabled."""
    client, _user, document = _owner_client(is_encrypted=True)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/{url_path}/",
        payload,
        format="json",
    )

    assert response.status_code == 403
