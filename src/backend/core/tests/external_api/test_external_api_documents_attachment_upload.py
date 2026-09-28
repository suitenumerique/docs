"""
Tests for the Resource Server API for document attachments.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

import re
import uuid
from urllib.parse import parse_qs, urlparse

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_external_api_documents_attachment_upload_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to upload attachments to a document
    from a resource server.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    pixel = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00"
        b"\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe"
        b"\xa7V\xbd\xfa\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    file = SimpleUploadedFile(name="test.png", content=pixel, content_type="image/png")

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/attachment-upload/",
        {"file": file},
        format="multipart",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
                "attachment_upload",
            ],
        },
    }
)
def test_external_api_documents_attachment_upload_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to upload attachments to a document
    from a resource server when the attachment-upload action is enabled in EXTERNAL_API settings.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    pixel = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00"
        b"\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe"
        b"\xa7V\xbd\xfa\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    file = SimpleUploadedFile(name="test.png", content=pixel, content_type="image/png")

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/attachment-upload/",
        {"file": file},
        format="multipart",
    )

    assert response.status_code == 201

    pattern = re.compile(rf"^{document.id!s}/attachments/(.*)\.png")
    url_parsed = urlparse(response.json()["file"])
    assert url_parsed.path == f"/api/v1.0/documents/{document.id!s}/media-check/"
    query = parse_qs(url_parsed.query)
    assert query["key"][0] is not None
    file_path = query["key"][0]
    match = pattern.search(file_path)
    file_id = match.group(1)  # type: ignore

    # Validate that file_id is a valid UUID
    uuid.UUID(file_id)
