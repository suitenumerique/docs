"""
Tests for the Resource Server API for documents.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.services import mime_types

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
    """A user with an invalid sub SHOULD NOT be allowed to retrieve documents
    from a resource server."""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    response = client.get("/external_api/v1.0/documents/")

    assert response.status_code == 401


def test_external_api_documents_retrieve_connected_resource_server_with_wrong_abilities(
    user_token, user_specific_sub, resource_server_backend
):
    """
    A user with wrong abilities SHOULD NOT be allowed to retrieve a document from
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
    A user with an access token SHOULD be allowed to retrieve a document from
    a resource server.
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


def test_external_api_documents_duplicate_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users CAN DUPLICATE a document from a resource server
    when they have the required permissions on the document,
    as this action bypasses the permission checks.
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

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/duplicate/",
    )

    assert response.status_code == 201


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


def test_external_api_documents_create_for_owner_not_allowed():
    """
    Authenticated users SHOULD NOT be allowed to call create documents
    on behalf of other users.
    This API endpoint is reserved for server-to-server calls.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    data = {
        "title": "My Document",
        "content": "Document content",
        "sub": "123",
        "email": "john.doe@example.com",
    }

    response = client.post(
        "/external_api/v1.0/documents/create-for-owner/",
        data,
        format="json",
    )

    assert response.status_code == 401
    assert not models.Document.objects.exists()


# Test overrides


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": ["list", "retrieve", "children", "trashbin"],
        },
    }
)
def test_external_api_documents_trashbin_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to list soft deleted documents from a resource server
    when the trashbin action is enabled in EXTERNAL_API settings.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )
    document.soft_delete()

    response = client.get("/external_api/v1.0/documents/trashbin/")

    assert response.status_code == 200

    content = response.json()
    results = content.pop("results")
    assert content == {
        "count": 1,
        "next": None,
        "previous": None,
    }
    assert len(results) == 1


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
            "actions": ["list", "retrieve", "children", "move"],
        },
    }
)
def test_external_api_documents_move_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to move a document from a resource server
    when the move action is enabled in EXTERNAL_API settings and they
    have the required permissions on the document and the target location.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    parent = factories.DocumentFactory(
        users=[(user_specific_sub, "owner")], teams=[("lasuite", "owner")]
    )
    # A document with no owner
    document = factories.DocumentFactory(
        parent=parent, users=[(user_specific_sub, "reader")]
    )
    target = factories.DocumentFactory()

    response = client.post(
        f"/external_api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "first-sibling"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": ["list", "retrieve", "children", "restore"],
        },
    }
)
def test_external_api_documents_restore_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to restore a recently soft-deleted document
    from a resource server when the restore action is enabled in EXTERNAL_API
    settings and they have the required permissions on the document.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    now = timezone.now() - timedelta(days=15)
    document = factories.DocumentFactory(deleted_at=now)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role="owner"
    )

    response = client.post(f"/external_api/v1.0/documents/{document.id!s}/restore/")

    assert response.status_code == 200
    assert response.json() == {"detail": "Document has been successfully restored."}

    document.refresh_from_db()
    assert document.deleted_at is None
    assert document.ancestors_deleted_at is None
