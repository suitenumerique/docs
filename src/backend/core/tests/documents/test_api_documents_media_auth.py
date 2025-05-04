"""
Test media-auth authorization API endpoint in docs core app.
"""

from io import BytesIO
from urllib.parse import urlparse
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone

import pytest
import requests
from freezegun import freeze_time
from rest_framework.test import APIClient

from core import factories, models
from core.enums import DocumentAttachmentStatus
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


def test_api_documents_media_auth_unkown_document():
    """
    Trying to download a media related to a document ID that does not exist
    should not have the side effect to create it (no regression test).
    """
    original_url = f"http://localhost/media/{uuid4()!s}/attachments/{uuid4()!s}.jpg"

    response = APIClient().get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
    )

    assert response.status_code == 403
    assert models.Document.objects.exists() is False


def test_api_documents_media_auth_anonymous_public():
    """Anonymous users should be able to retrieve attachments linked to a public document"""
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )

    factories.DocumentFactory(id=document_id, link_reach="public", attachments=[key])

    original_url = f"http://localhost/media/{key:s}"
    now = timezone.now()
    with freeze_time(now):
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


def test_api_documents_media_auth_extensions():
    """Files with extensions of any format should work."""
    extensions = [
        "c",
        "go",
        "gif",
        "mp4",
        "woff2",
        "appimage",
    ]
    document_id = uuid4()
    keys = []
    for ext in extensions:
        filename = f"{uuid4()!s}.{ext:s}"
        key = f"{document_id!s}/attachments/{filename:s}"
        default_storage.connection.meta.client.put_object(
            Bucket=default_storage.bucket_name,
            Key=key,
            Body=BytesIO(b"my prose"),
            ContentType="text/plain",
            Metadata={"status": DocumentAttachmentStatus.READY},
        )
        keys.append(key)

    factories.DocumentFactory(link_reach="public", attachments=keys)

    for key in keys:
        original_url = f"http://localhost/media/{key:s}"
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
        )

        assert response.status_code == 200


@pytest.mark.parametrize("reach", ["authenticated", "restricted"])
def test_api_documents_media_auth_anonymous_authenticated_or_restricted(reach):
    """
    Anonymous users should not be allowed to retrieve attachments linked to a document
    with link reach set to authenticated or restricted.
    """
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    media_url = f"http://localhost/media/{document_id!s}/attachments/{filename:s}"

    factories.DocumentFactory(id=document_id, link_reach=reach)

    response = APIClient().get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
    )

    assert response.status_code == 403
    assert "Authorization" not in response


def test_api_documents_media_auth_anonymous_attachments():
    """
    Declaring a media key as original attachment on a document to which
    a user has access should give them access to the attachment file
    regardless of their access rights on the original document.
    """
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    media_url = f"http://localhost/media/{key:s}"

    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )

    factories.DocumentFactory(id=document_id, link_reach="restricted")

    response = APIClient().get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
    )
    assert response.status_code == 403

    # Let's now add a document to which the anonymous user has access and
    # pointing to the attachment
    parent = factories.DocumentFactory(link_reach="public")
    factories.DocumentFactory(parent=parent, link_reach="restricted", attachments=[key])

    now = timezone.now()
    with freeze_time(now):
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_media_auth_authenticated_public_or_authenticated(reach):
    """
    Authenticated users who are not related to a document should be able to retrieve
    attachments related to a document with public or authenticated link reach.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    media_url = f"http://localhost/media/{key:s}"

    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )

    factories.DocumentFactory(id=document_id, link_reach=reach, attachments=[key])

    now = timezone.now()
    with freeze_time(now):
        response = client.get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


def test_api_documents_media_auth_authenticated_restricted():
    """
    Authenticated users who are not related to a document should not be allowed to
    retrieve attachments linked to a document that is restricted.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    media_url = f"http://localhost/media/{key:s}"

    factories.DocumentFactory(
        id=document_id, link_reach="restricted", attachments=[key]
    )

    response = client.get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
    )

    assert response.status_code == 403
    assert "Authorization" not in response


@pytest.mark.parametrize("via", VIA)
def test_api_documents_media_auth_related(via, mock_user_teams):
    """
    Users who have a specific access to a document, whatever the role, should be able to
    retrieve related attachments.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    media_url = f"http://localhost/media/{key:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )

    document = factories.DocumentFactory(
        id=document_id, link_reach="restricted", attachments=[key]
    )
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(document=document, team="lasuite")

    now = timezone.now()
    with freeze_time(now):
        response = client.get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"


def test_api_documents_media_auth_not_ready_status():
    """Attachments with status not ready should not be accessible"""
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
        Metadata={"status": DocumentAttachmentStatus.PROCESSING},
    )

    factories.DocumentFactory(id=document_id, link_reach="public", attachments=[key])

    original_url = f"http://localhost/media/{key:s}"
    response = APIClient().get(
        "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
    )

    assert response.status_code == 403


def test_api_documents_media_auth_missing_status_metadata():
    """Attachments without status metadata should be considered as ready"""
    document_id = uuid4()
    filename = f"{uuid4()!s}.jpg"
    key = f"{document_id!s}/attachments/{filename:s}"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"my prose"),
        ContentType="text/plain",
    )

    factories.DocumentFactory(id=document_id, link_reach="public", attachments=[key])

    now = timezone.now()
    original_url = f"http://localhost/media/{key:s}"
    with freeze_time(now):
        response = APIClient().get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=original_url
        )

    assert response.status_code == 200

    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    file_url = f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{key:s}"
    response = requests.get(
        file_url,
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content.decode("utf-8") == "my prose"
