"""
Test file uploads API endpoint for users in impress's core app.
"""

import base64
import uuid
from io import BytesIO
from urllib.parse import urlparse

from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone

import pycrdt
import pytest
import requests
from freezegun import freeze_time
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

PIXEL = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00"
    b"\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe"
    b"\xa7V\xbd\xfa\x00\x00\x00\x00IEND\xaeB`\x82"
)


def get_image_refs(document_id):
    """Generate an image key for testing."""
    image_key = f"{document_id!s}/attachments/{uuid.uuid4()!s}.png"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=image_key,
        Body=BytesIO(PIXEL),
        ContentType="image/png",
    )
    return image_key, f"http://localhost/media/{image_key:s}"


def test_api_documents_duplicate_forbidden():
    """A user who doesn't have read access to a document should not be allowed to duplicate it."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        link_reach="restricted",
        users=[factories.UserFactory()],
        title="my document",
    )

    response = client.post(f"/api/v1.0/documents/{document.id!s}/duplicate/")

    assert response.status_code == 403
    assert models.Document.objects.count() == 1


def test_api_documents_duplicate_anonymous():
    """Anonymous users should not be able to duplicate documents even with read access."""

    document = factories.DocumentFactory(link_reach="public")

    response = APIClient().post(f"/api/v1.0/documents/{document.id!s}/duplicate/")

    assert response.status_code == 401
    assert models.Document.objects.count() == 1


@pytest.mark.parametrize("index", range(3))
def test_api_documents_duplicate_success(index):
    """
    Anonymous users should be able to retrieve attachments linked to a public document.
    Accesses should not be duplicated if the user does not request it specifically.
    Attachments that are not in the content should not be passed for access in the
    duplicated document's "attachments" list.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document_ids = [uuid.uuid4() for _ in range(3)]
    image_refs = [get_image_refs(doc_id) for doc_id in document_ids]

    # Create document content with the first image only
    ydoc = pycrdt.Doc()
    fragment = pycrdt.XmlFragment(
        [
            pycrdt.XmlElement("img", {"src": image_refs[0][1]}),
        ]
    )
    ydoc["document-store"] = fragment
    update = ydoc.get_update()
    base64_content = base64.b64encode(update).decode("utf-8")

    # Create documents
    document = factories.DocumentFactory(
        id=document_ids[index],
        content=base64_content,
        link_reach="restricted",
        users=[user, factories.UserFactory()],
        title="document with an image",
        attachments=[key for key, _ in image_refs],
    )
    factories.DocumentFactory(id=document_ids[(index + 1) % 3])
    # Don't create document for third ID to check that it doesn't impact access to attachments

    # Duplicate the document via the API endpoint
    response = client.post(f"/api/v1.0/documents/{document.id}/duplicate/")

    assert response.status_code == 201

    duplicated_document = models.Document.objects.get(id=response.json()["id"])
    assert duplicated_document.title == "Copy of document with an image"
    assert duplicated_document.content == document.content
    assert duplicated_document.creator == user
    assert duplicated_document.link_reach == "restricted"
    assert duplicated_document.link_role == "reader"
    assert duplicated_document.duplicated_from == document
    assert duplicated_document.attachments == [
        image_refs[0][0]
    ]  # Only the first image key
    assert duplicated_document.get_parent() == document.get_parent()
    assert duplicated_document.path == document.get_next_sibling().path

    # Check that accesses were not duplicated.
    # The user who did the duplicate is forced as owner
    assert duplicated_document.accesses.count() == 1
    access = duplicated_document.accesses.first()
    assert access.user == user
    assert access.role == "owner"

    # Ensure access persists after the owner loses access to the original document
    models.DocumentAccess.objects.filter(document=document).delete()

    now = timezone.now()
    with freeze_time(now):
        response = client.get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=image_refs[0][1]
        )

    assert response.status_code == 200
    assert response["X-Amz-Date"] == now.strftime("%Y%m%dT%H%M%SZ")
    authorization = response["Authorization"]
    assert "AWS4-HMAC-SHA256 Credential=" in authorization
    assert (
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="
        in authorization
    )

    s3_url = urlparse(settings.AWS_S3_ENDPOINT_URL)
    response = requests.get(
        f"{settings.AWS_S3_ENDPOINT_URL:s}/impress-media-storage/{image_refs[0][0]:s}",
        headers={
            "authorization": authorization,
            "x-amz-date": response["x-amz-date"],
            "x-amz-content-sha256": response["x-amz-content-sha256"],
            "Host": f"{s3_url.hostname:s}:{s3_url.port:d}",
        },
        timeout=1,
    )
    assert response.content == PIXEL

    # Ensure the other images are not accessible
    for _, url in image_refs[1:]:
        response = client.get(
            "/api/v1.0/documents/media-auth/", HTTP_X_ORIGINAL_URL=url
        )
        assert response.status_code == 403


def test_api_documents_duplicate_with_accesses():
    """Accesses should be duplicated if the user requests it specifically."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        users=[user],
        title="document with accesses",
    )
    user_access = factories.UserDocumentAccessFactory(document=document)
    team_access = factories.TeamDocumentAccessFactory(document=document)

    # Duplicate the document via the API endpoint requesting to duplicate accesses
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/duplicate/",
        {"with_accesses": True},
        format="json",
    )

    assert response.status_code == 201

    duplicated_document = models.Document.objects.get(id=response.json()["id"])
    assert duplicated_document.title == "Copy of document with accesses"
    assert duplicated_document.content == document.content
    assert duplicated_document.link_reach == document.link_reach
    assert duplicated_document.link_role == document.link_role
    assert duplicated_document.creator == user
    assert duplicated_document.duplicated_from == document
    assert duplicated_document.attachments == []

    # Check that accesses were duplicated and the user who did the duplicate is forced as owner
    duplicated_accesses = duplicated_document.accesses
    assert duplicated_accesses.count() == 3
    assert duplicated_accesses.get(user=user).role == "owner"
    assert duplicated_accesses.get(user=user_access.user).role == user_access.role
    assert duplicated_accesses.get(team=team_access.team).role == team_access.role
