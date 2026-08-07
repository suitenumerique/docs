"""
Tests for Documents API endpoint in impress's core app: content updated
"""

from datetime import datetime, timedelta
from datetime import timezone as tz
from unittest import mock
from uuid import uuid4

import jwt
import pytest
import responses
from freezegun import freeze_time
from rest_framework.test import APIClient

from core import factories
from core.authentication import CollaborationServerAuthentication
from core.models import Document
from core.services.search_indexers import FindDocumentIndexer
from core.tests.utils.jwt_helper import build_jwks, generate_key_pair, key_id
from core.utils.yjs import base64_yjs_to_text

pytestmark = pytest.mark.django_db

# Generating an RSA key is expensive, do it once for the whole module
PRIVATE_KEY, PUBLIC_KEY = generate_key_pair()
JWKS_URL = "http://yhub:3002/collaboration/jwks/v1"


@pytest.fixture(name="yhub_jwks", autouse=True)
def yhub_jwks_fixture(settings):
    """
    Publish the collaboration server keys where the backend reads them.

    It only ever holds the public half of that key, and not even in its
    configuration: it fetches it from the collaboration server itself.
    """
    settings.YHUB_API_BASE_URL = "http://yhub:3002"

    with responses.RequestsMock(assert_all_requests_are_fired=False) as jwks:
        jwks.get(JWKS_URL, json=build_jwks(PUBLIC_KEY))
        yield jwks


def collaboration_token(private_key=PRIVATE_KEY, public_key=PUBLIC_KEY, **claims):
    """Sign a token the way the collaboration server does."""
    issued_at = datetime.now(tz=tz.utc)

    return jwt.encode(
        {
            "iss": "yhub",
            "aud": CollaborationServerAuthentication.AUDIENCE,
            "iat": issued_at,
            "exp": issued_at + timedelta(seconds=60),
            **claims,
        },
        private_key,
        algorithm="RS256",
        headers={"kid": key_id(public_key)},
    )


def test_api_documents_content_updated_anonymous():
    """Anonymous users should not be allowed to declare a content update."""
    document = factories.DocumentFactory()

    response = APIClient().post(f"/api/v1.0/documents/{document.id!s}/content-updated/")

    assert response.status_code == 401


def test_api_documents_content_updated_authenticated():
    """A logged-in user is not the collaboration server, their session is no credential."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)
    document = factories.DocumentFactory(users=[(user, "owner")])

    response = client.post(f"/api/v1.0/documents/{document.id!s}/content-updated/")

    assert response.status_code == 401


def test_api_documents_content_updated_token_signed_by_another_key():
    """🔒 A token signed by another key should not be allowed, published "kid" or not."""
    document = factories.DocumentFactory()
    other_private_key, _other_public_key = generate_key_pair()

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/content-updated/",
        # the key that signs it is not the one it names
        HTTP_AUTHORIZATION=f"Bearer {collaboration_token(other_private_key)}",
    )

    assert response.status_code == 401


def test_api_documents_content_updated_token_naming_an_unpublished_key():
    """A token naming a key the collaboration server does not publish is refused."""
    document = factories.DocumentFactory()
    token = jwt.encode(
        {
            "aud": CollaborationServerAuthentication.AUDIENCE,
            "exp": datetime.now(tz=tz.utc) + timedelta(seconds=60),
        },
        PRIVATE_KEY,
        algorithm="RS256",
        headers={"kid": "a-key-nobody-published"},
    )

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/content-updated/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 401


def test_api_documents_content_updated_token_naming_no_key():
    """A token that does not name the key it was signed with is refused."""
    document = factories.DocumentFactory()
    token = jwt.encode(
        {
            "aud": CollaborationServerAuthentication.AUDIENCE,
            "exp": datetime.now(tz=tz.utc) + timedelta(seconds=60),
        },
        PRIVATE_KEY,
        algorithm="RS256",
    )

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/content-updated/",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )

    assert response.status_code == 401


def test_api_documents_content_updated_token_for_another_audience():
    """A token the collaboration server minted for another service should be refused."""
    document = factories.DocumentFactory()

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/content-updated/",
        HTTP_AUTHORIZATION=f"Bearer {collaboration_token(aud='somewhere-else')}",
    )

    assert response.status_code == 401


def test_api_documents_content_updated_expired_token():
    """An expired token should be refused, they are short-lived on purpose."""
    document = factories.DocumentFactory()
    expired = datetime.now(tz=tz.utc) - timedelta(seconds=60)

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/content-updated/",
        HTTP_AUTHORIZATION=f"Bearer {collaboration_token(exp=expired)}",
    )

    assert response.status_code == 401


def test_api_documents_content_updated_collaboration_server_not_configured(settings):
    """Without a collaboration server to read the keys from, nothing is authenticated."""
    settings.YHUB_API_BASE_URL = None
    document = factories.DocumentFactory()

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/content-updated/",
        HTTP_AUTHORIZATION=f"Bearer {collaboration_token()}",
    )

    assert response.status_code == 401


def test_api_documents_content_updated_jwks_unavailable(yhub_jwks):
    """A collaboration server that publishes no key authenticates nobody."""
    yhub_jwks.reset()
    yhub_jwks.get(JWKS_URL, status=500)
    document = factories.DocumentFactory()

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/content-updated/",
        HTTP_AUTHORIZATION=f"Bearer {collaboration_token()}",
    )

    assert response.status_code == 401


def test_api_documents_content_updated_rolled_key(yhub_jwks):
    """
    A key rolled on the collaboration server should be picked up on its own.

    This is what publishing a JWKS buys over a key pinned in our settings:
    the tokens signed with the new key name a key we do not know, and looking
    it up fetches the set again.
    """
    document = factories.DocumentFactory()
    url = f"/api/v1.0/documents/{document.id!s}/content-updated/"

    # a first call caches the keys published so far
    response = APIClient().post(
        url, HTTP_AUTHORIZATION=f"Bearer {collaboration_token()}"
    )
    assert response.status_code == 204

    new_private_key, new_public_key = generate_key_pair()
    yhub_jwks.reset()
    yhub_jwks.get(JWKS_URL, json=build_jwks(new_public_key))

    response = APIClient().post(
        url,
        HTTP_AUTHORIZATION=(
            f"Bearer {collaboration_token(new_private_key, new_public_key)}"
        ),
    )

    assert response.status_code == 204


def test_api_documents_content_updated():
    """The collaboration server should be able to refresh the date of a document."""
    with freeze_time("2026-08-01 12:00:00"):
        # no content: writing one to S3 under a frozen clock breaks its signature
        document = factories.DocumentFactory(title="my document", content="")

    with freeze_time("2026-08-06 12:00:00"):
        response = APIClient().post(
            f"/api/v1.0/documents/{document.id!s}/content-updated/",
            HTTP_AUTHORIZATION=f"Bearer {collaboration_token()}",
        )

    assert response.status_code == 204

    document.refresh_from_db()
    assert document.updated_at == datetime(2026, 8, 6, 12, 0, 0, tzinfo=tz.utc)
    # the document itself is left alone
    assert document.created_at == datetime(2026, 8, 1, 12, 0, 0, tzinfo=tz.utc)
    assert document.title == "my document"


@pytest.mark.usefixtures("indexer_settings")
def test_api_documents_content_updated_indexes_the_document():
    """
    The content changed on the collaboration server: the search index follows.

    Nothing else refreshes it anymore, the content does not go through Django.
    """
    document = factories.DocumentFactory(title="my document")

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        response = APIClient().post(
            f"/api/v1.0/documents/{document.id!s}/content-updated/",
            HTTP_AUTHORIZATION=f"Bearer {collaboration_token()}",
        )

    assert response.status_code == 204
    # the task reads the content back from the collaboration server
    indexed = {doc["id"]: doc for doc in mock_push.call_args[0][0]}
    assert indexed[str(document.id)]["content"] == base64_yjs_to_text(
        factories.YDOC_HELLO_WORLD_BASE64
    )


@pytest.mark.usefixtures("indexer_settings")
def test_api_documents_content_updated_does_not_index_when_the_document_is_unknown():
    """A document that does not exist is not worth an indexation task."""
    with mock.patch("core.api.viewsets.trigger_batch_document_indexer") as mock_trigger:
        response = APIClient().post(
            f"/api/v1.0/documents/{uuid4()!s}/content-updated/",
            HTTP_AUTHORIZATION=f"Bearer {collaboration_token()}",
        )

    assert response.status_code == 404
    mock_trigger.assert_not_called()


def test_api_documents_content_updated_restricted_document():
    """
    The collaboration server acts for whoever is editing, the access of a
    document is not its business.
    """
    document = factories.DocumentFactory(link_reach="restricted")

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/content-updated/",
        HTTP_AUTHORIZATION=f"Bearer {collaboration_token()}",
    )

    assert response.status_code == 204


def test_api_documents_content_updated_unknown_document():
    """A document deleted in the meantime should answer a 404."""
    response = APIClient().post(
        f"/api/v1.0/documents/{uuid4()!s}/content-updated/",
        HTTP_AUTHORIZATION=f"Bearer {collaboration_token()}",
    )

    assert response.status_code == 404
    assert not Document.objects.exists()


def test_api_documents_content_updated_invalid_document_id():
    """A room name that is no document id should answer a 404, not a 500."""
    response = APIClient().post(
        "/api/v1.0/documents/not-an-uuid/content-updated/",
        HTTP_AUTHORIZATION=f"Bearer {collaboration_token()}",
    )

    assert response.status_code == 404
