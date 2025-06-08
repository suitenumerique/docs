"""Test the "media_check" endpoint."""

from io import BytesIO
from uuid import uuid4

from django.core.files.storage import default_storage

import pytest
from rest_framework.test import APIClient

from core import factories
from core.enums import DocumentAttachmentStatus
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


def test_api_documents_media_check_unknown_document():
    """
    The "media_check" endpoint should return a 404 error if the document does not exist.
    """
    client = APIClient()
    response = client.get(f"/api/v1.0/documents/{uuid4()!s}media-check/")
    assert response.status_code == 404


def test_api_documents_media_check_missing_key():
    """
    The "media_check" endpoint should return a 404 error if the key is missing.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user=user)

    document = factories.DocumentFactory(users=[user])

    response = client.get(f"/api/v1.0/documents/{document.id!s}/media-check/")
    assert response.status_code == 400
    assert response.json() == {"detail": "Missing 'key' query parameter"}


def test_api_documents_media_check_key_parameter_not_related_to_document():
    """
    The "media_check" endpoint should return a 404 error if the key is not related to the document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user=user)

    document = factories.DocumentFactory(users=[user])

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/media-check/",
        {"key": f"{document.id!s}/attachments/unknown.jpg"},
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Attachment missing"}


def test_api_documents_media_check_anonymous_public_document():
    """
    The "media_check" endpoint should return a 200 status code if the document is public.
    """
    document = factories.DocumentFactory(link_reach="public")

    filename = f"{uuid4()!s}.jpg"
    key = f"{document.id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.PROCESSING},
    )
    document.attachments = [key]
    document.save(update_fields=["attachments"])

    client = APIClient()

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/media-check/", {"key": key}
    )
    assert response.status_code == 200
    assert response.json() == {"status": DocumentAttachmentStatus.PROCESSING}


def test_api_documents_media_check_anonymous_public_document_ready():
    """
    The "media_check" endpoint should return a 200 status code if the document is public.
    """
    document = factories.DocumentFactory(link_reach="public")

    filename = f"{uuid4()!s}.jpg"
    key = f"{document.id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )
    document.attachments = [key]
    document.save(update_fields=["attachments"])

    client = APIClient()

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/media-check/", {"key": key}
    )
    assert response.status_code == 200
    assert response.json() == {
        "status": DocumentAttachmentStatus.READY,
        "file": f"/media/{key:s}",
    }


@pytest.mark.parametrize("link_reach", ["restricted", "authenticated"])
def test_api_documents_media_check_anonymous_non_public_document(link_reach):
    """
    The "media_check" endpoint should return a 403 error if the document is not public.
    """
    document = factories.DocumentFactory(link_reach=link_reach)

    client = APIClient()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/media-check/")
    assert response.status_code == 401


def test_api_documents_media_check_connected_document():
    """
    The "media_check" endpoint should return a 200 status code for a user connected
    checking for a document with link_reach authenticated.
    """
    document = factories.DocumentFactory(link_reach="authenticated")

    filename = f"{uuid4()!s}.jpg"
    key = f"{document.id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )
    document.attachments = [key]
    document.save(update_fields=["attachments"])

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user=user)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/media-check/", {"key": key}
    )
    assert response.status_code == 200
    assert response.json() == {
        "status": DocumentAttachmentStatus.READY,
        "file": f"/media/{key:s}",
    }


def test_api_documents_media_check_connected_document_media_not_related():
    """
    The "media_check" endpoint should return a 404 error if the key is not related to the document.
    """
    document = factories.DocumentFactory(link_reach="authenticated")

    filename = f"{uuid4()!s}.jpg"
    key = f"{document.id!s}/attachments/{filename:s}"

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user=user)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/media-check/", {"key": key}
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Attachment missing"}


def test_api_documents_media_check_media_missing_on_storage():
    """
    The "media_check" endpoint should return a 404 error if the media is missing on storage.
    """
    document = factories.DocumentFactory(link_reach="authenticated")

    filename = f"{uuid4()!s}.jpg"
    key = f"{document.id!s}/attachments/{filename:s}"

    document.attachments = [key]
    document.save(update_fields=["attachments"])

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user=user)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/media-check/", {"key": key}
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Media not found"}


@pytest.mark.parametrize("via", VIA)
def test_api_documents_media_check_restricted_document(via, mock_user_teams):
    """
    The "media_check" endpoint should return a 200 status code if the document is restricted and
    the user has access to it.
    """
    document = factories.DocumentFactory(link_reach="restricted")
    filename = f"{uuid4()!s}.jpg"
    key = f"{document.id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )
    document.attachments = [key]
    document.save(update_fields=["attachments"])

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user=user)

    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(document=document, team="lasuite")

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/media-check/", {"key": key}
    )
    assert response.status_code == 200
    assert response.json() == {
        "status": DocumentAttachmentStatus.READY,
        "file": f"/media/{key:s}",
    }
