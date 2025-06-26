"""
Test file uploads API endpoint for users in impress's core app.
"""

import re
import uuid
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile

import pytest
from rest_framework.test import APIClient

from core import factories
from core.api.viewsets import malware_detection
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db

PIXEL = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00"
    b"\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe"
    b"\xa7V\xbd\xfa\x00\x00\x00\x00IEND\xaeB`\x82"
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
def test_api_documents_attachment_upload_anonymous_forbidden(reach, role):
    """
    Anonymous users should not be able to upload attachments if the link reach
    and role don't allow it.
    """
    document = factories.DocumentFactory(link_reach=reach, link_role=role)
    file = SimpleUploadedFile(name="test.png", content=PIXEL, content_type="image/png")

    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"
    response = APIClient().post(url, {"file": file}, format="multipart")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_documents_attachment_upload_anonymous_success():
    """
    Anonymous users should be able to upload attachments to a document
    if the link reach and role permit it.
    """
    document = factories.DocumentFactory(link_reach="public", link_role="editor")
    file = SimpleUploadedFile(name="test.png", content=PIXEL, content_type="image/png")

    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"
    with mock.patch.object(malware_detection, "analyse_file") as mock_analyse_file:
        response = APIClient().post(url, {"file": file}, format="multipart")

    assert response.status_code == 201

    pattern = re.compile(rf"^{document.id!s}/attachments/(.*)\.png")
    url_parsed = urlparse(response.json()["file"])
    assert url_parsed.path == f"/api/v1.0/documents/{document.id!s}/media-check/"
    query = parse_qs(url_parsed.query)
    assert query["key"][0] is not None
    file_path = query["key"][0]
    match = pattern.search(file_path)
    file_id = match.group(1)
    # Validate that file_id is a valid UUID
    uuid.UUID(file_id)

    document.refresh_from_db()
    assert document.attachments == [f"{document.id!s}/attachments/{file_id!s}.png"]

    # Now, check the metadata of the uploaded file
    key = file_path.replace("/media/", "")
    mock_analyse_file.assert_called_once_with(key, document_id=document.id)
    file_head = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=key
    )

    assert file_head["Metadata"] == {"owner": "None", "status": "processing"}
    assert file_head["ContentType"] == "image/png"
    assert file_head["ContentDisposition"] == 'inline; filename="test.png"'


@pytest.mark.parametrize(
    "reach, role",
    [
        ("restricted", "reader"),
        ("restricted", "editor"),
        ("authenticated", "reader"),
        ("public", "reader"),
    ],
)
def test_api_documents_attachment_upload_authenticated_forbidden(reach, role):
    """
    Users who are not related to a document can't upload attachments if the
    link reach and role don't allow it.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)
    file = SimpleUploadedFile(name="test.png", content=PIXEL, content_type="image/png")

    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"
    response = client.post(url, {"file": file}, format="multipart")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    assert document.attachments == []


@pytest.mark.parametrize(
    "reach, role",
    [
        ("authenticated", "editor"),
        ("public", "editor"),
    ],
)
def test_api_documents_attachment_upload_authenticated_success(reach, role):
    """
    Authenticated users who are not related to a document should be able to upload
    a file when the link reach and role permit it.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)
    file = SimpleUploadedFile(name="test.png", content=PIXEL, content_type="image/png")

    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"
    with mock.patch.object(malware_detection, "analyse_file") as mock_analyse_file:
        response = client.post(url, {"file": file}, format="multipart")

    assert response.status_code == 201

    pattern = re.compile(rf"^{document.id!s}/attachments/(.*)\.png")
    url_parsed = urlparse(response.json()["file"])
    assert url_parsed.path == f"/api/v1.0/documents/{document.id!s}/media-check/"
    query = parse_qs(url_parsed.query)
    assert query["key"][0] is not None
    file_path = query["key"][0]
    match = pattern.search(file_path)
    file_id = match.group(1)

    mock_analyse_file.assert_called_once_with(
        f"{document.id!s}/attachments/{file_id!s}.png", document_id=document.id
    )

    # Validate that file_id is a valid UUID
    uuid.UUID(file_id)

    document.refresh_from_db()
    assert document.attachments == [f"{document.id!s}/attachments/{file_id!s}.png"]


@pytest.mark.parametrize("via", VIA)
def test_api_documents_attachment_upload_reader(via, mock_user_teams):
    """
    Users who are simple readers on a document should not be allowed to upload an attachment.
    """
    user = factories.UserFactory(with_owned_document=True)

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

    file = SimpleUploadedFile(name="test.png", content=PIXEL, content_type="image/png")

    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"
    response = client.post(url, {"file": file}, format="multipart")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    assert document.attachments == []


@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_attachment_upload_success(via, role, mock_user_teams):
    """
    Editors, administrators and owners of a document should be able to upload an attachment.
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

    file = SimpleUploadedFile(name="test.png", content=PIXEL, content_type="image/png")

    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"
    with mock.patch.object(malware_detection, "analyse_file") as mock_analyse_file:
        response = client.post(url, {"file": file}, format="multipart")

    assert response.status_code == 201

    pattern = re.compile(rf"^{document.id!s}/attachments/(.*)\.png")
    url_parsed = urlparse(response.json()["file"])
    assert url_parsed.path == f"/api/v1.0/documents/{document.id!s}/media-check/"
    query = parse_qs(url_parsed.query)
    assert query["key"][0] is not None
    file_path = query["key"][0]
    match = pattern.search(file_path)
    file_id = match.group(1)

    # Validate that file_id is a valid UUID
    uuid.UUID(file_id)

    document.refresh_from_db()
    assert document.attachments == [f"{document.id!s}/attachments/{file_id!s}.png"]

    # Now, check the metadata of the uploaded file
    key = file_path.replace("/media/", "")
    mock_analyse_file.assert_called_once_with(key, document_id=document.id)
    file_head = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=key
    )
    assert file_head["Metadata"] == {"owner": str(user.id), "status": "processing"}
    assert file_head["ContentType"] == "image/png"
    assert file_head["ContentDisposition"] == 'inline; filename="test.png"'


def test_api_documents_attachment_upload_invalid(client):
    """Attempt to upload without a file should return an explicit error."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"

    response = client.post(url, {}, format="multipart")

    assert response.status_code == 400
    assert response.json() == {"file": ["No file was submitted."]}

    document.refresh_from_db()
    assert document.attachments == []


def test_api_documents_attachment_upload_size_limit_exceeded(settings):
    """The uploaded file should not exceed the maximum size in settings."""
    settings.DOCUMENT_IMAGE_MAX_SIZE = 1048576  # 1 MB for test

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"

    # Create a temporary file larger than the allowed size
    file = SimpleUploadedFile(
        name="test.txt", content=b"a" * (1048576 + 1), content_type="text/plain"
    )

    response = client.post(url, {"file": file}, format="multipart")

    assert response.status_code == 400
    assert response.json() == {"file": ["File size exceeds the maximum limit of 1 MB."]}

    document.refresh_from_db()
    assert document.attachments == []


@pytest.mark.parametrize(
    "name,content,extension,content_type",
    [
        ("test.exe", b"text", "exe", "text/plain"),
        ("test", b"text", "txt", "text/plain"),
        ("test.aaaaaa", b"test", "txt", "text/plain"),
        ("test.txt", PIXEL, "txt", "image/png"),
        ("test.py", b"#!/usr/bin/python", "py", "text/plain"),
    ],
)
def test_api_documents_attachment_upload_fix_extension(
    name, content, extension, content_type
):
    """
    A file with no extension or a wrong extension is accepted and the extension
    is corrected in storage.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"

    file = SimpleUploadedFile(name=name, content=content)
    with mock.patch.object(malware_detection, "analyse_file") as mock_analyse_file:
        response = client.post(url, {"file": file}, format="multipart")

    assert response.status_code == 201

    pattern = re.compile(rf"^{document.id!s}/attachments/(.*)\.{extension:s}")
    url_parsed = urlparse(response.json()["file"])
    assert url_parsed.path == f"/api/v1.0/documents/{document.id!s}/media-check/"
    query = parse_qs(url_parsed.query)
    assert query["key"][0] is not None
    file_path = query["key"][0]

    match = pattern.search(file_path)
    file_id = match.group(1)

    document.refresh_from_db()
    assert document.attachments == [
        f"{document.id!s}/attachments/{file_id!s}.{extension:s}"
    ]

    assert "-unsafe" in file_id
    # Validate that file_id is a valid UUID
    file_id = file_id.replace("-unsafe", "")
    uuid.UUID(file_id)

    # Now, check the metadata of the uploaded file
    key = file_path.replace("/media/", "")
    mock_analyse_file.assert_called_once_with(key, document_id=document.id)
    file_head = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=key
    )
    assert file_head["Metadata"] == {
        "owner": str(user.id),
        "is_unsafe": "true",
        "status": "processing",
    }
    assert file_head["ContentType"] == content_type
    assert file_head["ContentDisposition"] == f'attachment; filename="{name:s}"'


def test_api_documents_attachment_upload_empty_file():
    """An empty file should be rejected."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"

    file = SimpleUploadedFile(name="test.png", content=b"")
    response = client.post(url, {"file": file}, format="multipart")

    assert response.status_code == 400
    assert response.json() == {"file": ["The submitted file is empty."]}

    document.refresh_from_db()
    assert document.attachments == []


def test_api_documents_attachment_upload_unsafe():
    """A file with an unsafe mime type should be tagged as such."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"

    file = SimpleUploadedFile(
        name="script.exe", content=b"\x4d\x5a\x90\x00\x03\x00\x00\x00"
    )
    with mock.patch.object(malware_detection, "analyse_file") as mock_analyse_file:
        response = client.post(url, {"file": file}, format="multipart")

    assert response.status_code == 201

    pattern = re.compile(rf"^{document.id!s}/attachments/(.*)\.exe")
    url_parsed = urlparse(response.json()["file"])
    assert url_parsed.path == f"/api/v1.0/documents/{document.id!s}/media-check/"
    query = parse_qs(url_parsed.query)
    assert query["key"][0] is not None
    file_path = query["key"][0]
    match = pattern.search(file_path)
    file_id = match.group(1)

    document.refresh_from_db()
    assert document.attachments == [f"{document.id!s}/attachments/{file_id!s}.exe"]

    assert "-unsafe" in file_id
    # Validate that file_id is a valid UUID
    file_id = file_id.replace("-unsafe", "")
    uuid.UUID(file_id)

    key = file_path.replace("/media/", "")
    mock_analyse_file.assert_called_once_with(key, document_id=document.id)
    # Now, check the metadata of the uploaded file
    file_head = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=key
    )
    assert file_head["Metadata"] == {
        "owner": str(user.id),
        "is_unsafe": "true",
        "status": "processing",
    }
    # Depending the libmagic version, the content type may change.
    assert file_head["ContentType"] in [
        "application/x-dosexec",
        "application/octet-stream",
    ]
    assert file_head["ContentDisposition"] == 'attachment; filename="script.exe"'


def test_api_documents_attachment_upload_unsafe_mime_types_disabled(settings):
    """A file with an unsafe mime type but checking disabled should not be tagged as unsafe."""
    settings.DOCUMENT_ATTACHMENT_CHECK_UNSAFE_MIME_TYPES_ENABLED = False

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    url = f"/api/v1.0/documents/{document.id!s}/attachment-upload/"

    file = SimpleUploadedFile(
        name="script.exe", content=b"\x4d\x5a\x90\x00\x03\x00\x00\x00"
    )
    with mock.patch.object(malware_detection, "analyse_file") as mock_analyse_file:
        response = client.post(url, {"file": file}, format="multipart")

    assert response.status_code == 201

    pattern = re.compile(rf"^{document.id!s}/attachments/(.*)\.exe")
    url_parsed = urlparse(response.json()["file"])
    assert url_parsed.path == f"/api/v1.0/documents/{document.id!s}/media-check/"
    query = parse_qs(url_parsed.query)
    assert query["key"][0] is not None
    file_path = query["key"][0]
    match = pattern.search(file_path)
    file_id = match.group(1)

    document.refresh_from_db()
    assert document.attachments == [f"{document.id!s}/attachments/{file_id!s}.exe"]

    assert "-unsafe" not in file_id
    # Validate that file_id is a valid UUID
    uuid.UUID(file_id)

    key = file_path.replace("/media/", "")
    mock_analyse_file.assert_called_once_with(key, document_id=document.id)
    # Now, check the metadata of the uploaded file
    file_head = default_storage.connection.meta.client.head_object(
        Bucket=default_storage.bucket_name, Key=key
    )
    assert file_head["Metadata"] == {
        "owner": str(user.id),
        "status": "processing",
    }
    # Depending the libmagic version, the content type may change.
    assert file_head["ContentType"] in [
        "application/x-dosexec",
        "application/octet-stream",
    ]
    assert file_head["ContentDisposition"] == 'attachment; filename="script.exe"'
