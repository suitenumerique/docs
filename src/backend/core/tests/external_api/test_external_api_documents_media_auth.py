"""
Tests for the Resource Server API for document media authentication.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

from io import BytesIO
from uuid import uuid4

from django.core.files.storage import default_storage
from django.test import override_settings
from django.utils import timezone

import pytest
from freezegun import freeze_time
from rest_framework.test import APIClient

from core import factories, models
from core.enums import DocumentAttachmentStatus

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_external_api_documents_media_auth_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to access media auth endpoints
    from a resource server by default.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    response = client.get("/external_api/v1.0/documents/media-auth/")

    assert response.status_code == 403


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
                "media_auth",
            ],
        },
    }
)
def test_external_api_documents_media_auth_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to access media auth endpoints
    from a resource server when the media-auth action is enabled in EXTERNAL_API settings.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

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
        id=document_id, link_reach=models.LinkReachChoices.RESTRICTED, attachments=[key]
    )
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.READER
    )

    now = timezone.now()
    with freeze_time(now):
        response = client.get(
            "/external_api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=media_url
        )

    assert response.status_code == 200
