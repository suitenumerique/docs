"""
Tests for the Resource Server API for documents.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.services import mime_types
from core.tests.utils.urls import reload_urls

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_external_api_documents_retrieve_anonymous_public_standalone():
    """
    Anonymous users SHOULD NOT be allowed to retrieve a document from external
    API if resource server is not enabled.
    """
    document = factories.DocumentFactory(link_reach="public")

    response = APIClient().get(f"/external_api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 404


def test_external_api_documents_list_connected_not_resource_server():
    """
    Connected users SHOULD NOT be allowed to list documents if resource server is not enabled.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(document=document, user=user, role="reader")

    response = client.get("/external_api/v1.0/documents/")

    assert response.status_code == 404


def test_external_api_documents_list_connected_resource_server(
    user_token, resource_server_backend, user_specific_sub
):
    """Connected users should be allowed to list documents from a resource server."""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role="reader"
    )

    response = client.get("/external_api/v1.0/documents/")

    assert response.status_code == 200


def test_external_api_documents_list_connected_resource_server_with_invalid_token(
    user_token, resource_server_backend
):
    """User with an invalid sub should not be allowed to retrieve documents from a resource server."""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    response = client.get("/external_api/v1.0/documents/")

    assert response.status_code == 401


def test_external_api_documents_retrieve_connected_resource_server_with_wrong_abilities(
    user_token, user_specific_sub, resource_server_backend
):
    """
    User with wrong abilities should not be allowed to retrieve a document from
    a resource server.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)

    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 403


def test_external_api_documents_retrieve_connected_resource_server_using_access_token(
    user_token, resource_server_backend, user_specific_sub
):
    """
    User with an access token should be allowed to retrieve a document from a resource server.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")
    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.LinkRoleChoices.READER
    )

    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 200


def test_external_api_documents_create_root_success(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Users with an access token should be able to create a root document through the resource
    server and should automatically be declared as the owner of the newly created document.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    response = client.post(
        "/external_api/v1.0/documents/",
        {
            "title": "Test Root Document",
        },
    )

    assert response.status_code == 201

    data = response.json()
    document = models.Document.objects.get(id=data["id"])

    assert document.title == "Test Root Document"
    assert document.creator == user_specific_sub
    assert document.accesses.filter(role="owner", user=user_specific_sub).exists()


def test_external_api_documents_create_subdocument_owner_success(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Users with an access token SHOULD BE able to create a sub-document through the resource
    server when they have OWNER permissions on the parent document.
    The creator is set to the authenticated user, and permissions are inherited
    from the parent document.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    # Create a parent document first
    parent_document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=parent_document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.post(
        f"/external_api/v1.0/documents/{parent_document.id}/children/",
        {
            "title": "Test Sub Document",
        },
    )

    assert response.status_code == 201

    data = response.json()
    document = models.Document.objects.get(id=data["id"])

    assert document.title == "Test Sub Document"
    assert document.creator == user_specific_sub
    assert document.get_parent() == parent_document
    # Child documents inherit permissions from parent, no direct access needed
    assert not document.accesses.exists()


def test_external_api_documents_create_subdocument_editor_success(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Users with an access token SHOULD BE able to create a sub-document through the resource
    server when they have EDITOR permissions on the parent document.
    Permissions are inherited from the parent document.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    # Create a parent document first
    parent_document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
    )
    factories.UserDocumentAccessFactory(
        document=parent_document,
        user=user_specific_sub,
        role=models.RoleChoices.EDITOR,
    )

    response = client.post(
        f"/external_api/v1.0/documents/{parent_document.id}/children/",
        {
            "title": "Test Sub Document",
        },
    )

    assert response.status_code == 201

    data = response.json()
    document = models.Document.objects.get(id=data["id"])

    assert document.title == "Test Sub Document"
    assert document.creator == user_specific_sub
    assert document.get_parent() == parent_document
    # Child documents inherit permissions from parent, no direct access needed
    assert not document.accesses.exists()


def test_external_api_documents_create_subdocument_reader_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Users with an access token SHOULD NOT be able to create a sub-document through the resource
    server when they have READER permissions on the parent document.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    # Create a parent document first
    parent_document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
    )
    factories.UserDocumentAccessFactory(
        document=parent_document,
        user=user_specific_sub,
        role=models.RoleChoices.READER,
    )

    response = client.post(
        f"/external_api/v1.0/documents/{parent_document.id}/children/",
        {
            "title": "Test Sub Document",
        },
    )

    assert response.status_code == 403


@patch("core.services.converter_services.Converter.convert")
def test_external_api_documents_create_with_markdown_file_success(
    mock_convert, user_token, resource_server_backend, user_specific_sub
):
    """
    Users with an access token should be able to create documents through the resource
    server by uploading a Markdown file and should automatically be declared as the owner
    of the newly created document.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    # Mock the conversion
    converted_yjs = "base64encodedyjscontent"
    mock_convert.return_value = converted_yjs

    # Create a fake Markdown file
    file_content = b"# Test Document\n\nThis is a test."
    file = BytesIO(file_content)
    file.name = "readme.md"

    response = client.post(
        "/external_api/v1.0/documents/",
        {
            "file": file,
        },
        format="multipart",
    )

    assert response.status_code == 201

    data = response.json()
    document = models.Document.objects.get(id=data["id"])

    assert document.title == "readme.md"
    assert document.content == converted_yjs
    assert document.accesses.filter(role="owner", user=user_specific_sub).exists()

    # Verify the converter was called correctly
    mock_convert.assert_called_once_with(
        file_content,
        content_type=mime_types.MARKDOWN,
        accept=mime_types.YJS,
    )


def test_external_api_documents_list_with_multiple_roles(
    user_token, resource_server_backend, user_specific_sub
):
    """
    List all documents accessible to a user with different roles and verify
    that associated permissions are correctly returned in the response.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    # Create documents with different roles for the user
    owner_document = factories.DocumentFactory(
        title="Owner Document",
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=owner_document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    editor_document = factories.DocumentFactory(
        title="Editor Document",
        link_reach=models.LinkReachChoices.RESTRICTED,
    )
    factories.UserDocumentAccessFactory(
        document=editor_document,
        user=user_specific_sub,
        role=models.RoleChoices.EDITOR,
    )

    reader_document = factories.DocumentFactory(
        title="Reader Document",
        link_reach=models.LinkReachChoices.RESTRICTED,
    )
    factories.UserDocumentAccessFactory(
        document=reader_document,
        user=user_specific_sub,
        role=models.RoleChoices.READER,
    )

    # Create a document the user should NOT have access to
    other_document = factories.DocumentFactory(
        title="Other Document",
        link_reach=models.LinkReachChoices.RESTRICTED,
    )
    other_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(
        document=other_document,
        user=other_user,
        role=models.RoleChoices.OWNER,
    )

    response = client.get("/external_api/v1.0/documents/")

    assert response.status_code == 200
    data = response.json()

    # Verify the response contains results
    assert "results" in data
    results = data["results"]

    # Verify user can see exactly 3 documents (owner, editor, reader)
    result_ids = {result["id"] for result in results}
    assert len(results) == 3
    assert str(owner_document.id) in result_ids
    assert str(editor_document.id) in result_ids
    assert str(reader_document.id) in result_ids
    assert str(other_document.id) not in result_ids

    # Verify each document has correct user_role field indicating permission level
    for result in results:
        if result["id"] == str(owner_document.id):
            assert result["title"] == "Owner Document"
            assert result["user_role"] == models.RoleChoices.OWNER
        elif result["id"] == str(editor_document.id):
            assert result["title"] == "Editor Document"
            assert result["user_role"] == models.RoleChoices.EDITOR
        elif result["id"] == str(reader_document.id):
            assert result["title"] == "Reader Document"
            assert result["user_role"] == models.RoleChoices.READER


# NOT allowed actions on resource server.


def test_external_api_documents_put_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to PUT a document from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.put(
        f"/external_api/v1.0/documents/{document.id!s}/", {"title": "new title"}
    )

    assert response.status_code == 403


def test_external_api_document_delete_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to delete a document from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.delete(f"/external_api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 403


def test_external_api_documents_move_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to MOVE a document from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    new_parent = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=new_parent,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/move/",
        {"target_document_id": new_parent.id},
    )

    assert response.status_code == 403


def test_external_api_documents_restore_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to restore a document from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.post(f"/external_api/v1.0/documents/{document.id!s}/restore/")

    assert response.status_code == 403


@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_external_api_documents_trashbin_not_allowed(
    role, reach, user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to list documents from the trashbin,
    regardless of the document link reach and user role, from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=reach,
        creator=user_specific_sub,
        deleted_at=timezone.now(),
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=role,
    )

    response = client.get("/external_api/v1.0/documents/trashbin/")

    assert response.status_code == 403


def test_external_api_documents_versions_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to list the versions of a document
    from a resource server.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/versions/")

    assert response.status_code == 403


def test_external_api_documents_favorites_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to list their favorites
    from a resource server, as favorite_list() bypasses permissions.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.UserDocumentAccessFactory(
        user=user_specific_sub,
        role=models.RoleChoices.READER,
        document__favorited_by=[user_specific_sub],
    ).document

    response = client.get(f"/external_api/v1.0/documents/favorite_list/")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == str(document.id)


def test_external_api_documents_link_configuration_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to update the link configuration of a document
    from a resource server.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.put(
        f"/external_api/v1.0/documents/{document.id!s}/link-configuration/"
    )

    assert response.status_code == 403


def test_external_api_documents_attachment_upload_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to upload attachments to a document
    from a resource server.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    PIXEL = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00"
        b"\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe"
        b"\xa7V\xbd\xfa\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    file = SimpleUploadedFile(name="test.png", content=PIXEL, content_type="image/png")

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/attachment-upload/",
        {"file": file},
        format="multipart",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_external_api_document_accesses_not_allowed(
    user_token, resource_server_backend_conf, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to list the accesses of
    a document from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/accesses/")

    assert response.status_code == 404


def test_external_api_documents_accesses_create_not_allowed(
    user_token, resource_server_backend_conf, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to create an access for a document from a resource server.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    other_user = factories.UserFactory()

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/accesses/",
        {"user_id": other_user.id, "role": models.RoleChoices.READER},
    )

    assert response.status_code == 404


# Test overrides


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": ["list", "retrieve", "children", "destroy"],
        },
    }
)
def test_external_api_documents_delete_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to delete a document from a resource server
    when the delete action is enabled in EXTERNAL_API settings.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    response = client.delete(f"/external_api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 204
    # Verify the document is soft deleted
    document.refresh_from_db()
    assert document.deleted_at is not None


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
                "update",
            ],
        },
    }
)
def test_external_api_documents_update_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to update a document from a resource server
    when the update action is enabled in EXTERNAL_API settings.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    original_title = document.title
    response = client.put(
        f"/external_api/v1.0/documents/{document.id!s}/", {"title": "new title"}
    )

    assert response.status_code == 200
    # Verify the document is updated
    document.refresh_from_db()
    assert document.title == "new title"
    assert document.title != original_title


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
            ],
        },
        "document_access": {
            "enabled": True,
            "actions": ["list", "retrieve"],
        },
    }
)
def test_external_api_document_accesses_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to list the accesses of a document from a resource server
    when the list action is enabled in EXTERNAL_API document_access settings.
    """

    reload_urls()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED, creator=user_specific_sub
    )
    user_access = factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )
    # Create additional accesses
    other_user = factories.UserFactory()
    other_access = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role=models.RoleChoices.READER
    )

    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/accesses/")

    assert response.status_code == 200
    data = response.json()

    access_ids = [entry["id"] for entry in data]
    assert str(user_access.id) in access_ids
    assert str(other_access.id) in access_ids
