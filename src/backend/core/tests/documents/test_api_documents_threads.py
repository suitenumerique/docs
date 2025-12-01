"""Test Thread viewset."""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

# pylint: disable=too-many-lines


# Create


def test_api_documents_threads_public_document_link_role_reader():
    """
    Anonymous users should not be allowed to create threads on public documents with reader
    link_role.
    """
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=models.LinkRoleChoices.READER,
    )

    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/",
        {
            "body": "test",
        },
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "link_role", [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
)
def test_api_documents_threads_public_document(link_role):
    """
    Anonymous users should be allowed to create threads on public documents with commenter
    link_role.
    """
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=link_role,
    )

    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/",
        {
            "body": "test",
        },
    )

    assert response.status_code == 201
    thread = models.Thread.objects.first()
    comment = thread.comments.first()
    content = response.json()
    assert content == {
        "id": str(thread.id),
        "created_at": thread.created_at.isoformat().replace("+00:00", "Z"),
        "updated_at": thread.updated_at.isoformat().replace("+00:00", "Z"),
        "creator": None,
        "comments": [
            {
                "id": str(comment.id),
                "body": "test",
                "created_at": comment.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment.updated_at.isoformat().replace("+00:00", "Z"),
                "user": None,
                "reactions": [],
                "abilities": {
                    "destroy": False,
                    "update": False,
                    "partial_update": False,
                    "reactions": False,
                    "retrieve": True,
                },
            }
        ],
        "abilities": {
            "destroy": False,
            "update": False,
            "partial_update": False,
            "resolve": False,
            "retrieve": True,
        },
        "metadata": {},
        "resolved": False,
        "resolved_at": None,
        "resolved_by": None,
    }


def test_api_documents_threads_restricted_document():
    """
    Authenticated users should not be allowed to create threads on restricted
    documents with reader roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.READER,
        users=[(user, models.LinkRoleChoices.READER)],
    )

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/",
        {
            "body": "test",
        },
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "role",
    [role for role in models.RoleChoices.values if role != models.RoleChoices.READER],
)
def test_api_documents_threads_restricted_document_editor(role):
    """
    Authenticated users should be allowed to create threads on restricted
    documents with editor roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.EDITOR,
        users=[(user, role)],
    )

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/",
        {
            "body": "test",
        },
    )

    assert response.status_code == 201
    thread = models.Thread.objects.first()
    comment = thread.comments.first()
    content = response.json()
    assert content == {
        "id": str(thread.id),
        "created_at": thread.created_at.isoformat().replace("+00:00", "Z"),
        "updated_at": thread.updated_at.isoformat().replace("+00:00", "Z"),
        "creator": {
            "full_name": user.full_name,
            "short_name": user.short_name,
        },
        "comments": [
            {
                "id": str(comment.id),
                "body": "test",
                "created_at": comment.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": user.full_name,
                    "short_name": user.short_name,
                },
                "reactions": [],
                "abilities": {
                    "destroy": True,
                    "update": True,
                    "partial_update": True,
                    "reactions": True,
                    "retrieve": True,
                },
            }
        ],
        "abilities": {
            "destroy": True,
            "update": True,
            "partial_update": True,
            "resolve": True,
            "retrieve": True,
        },
        "metadata": {},
        "resolved": False,
        "resolved_at": None,
        "resolved_by": None,
    }


def test_api_documents_threads_authenticated_document_anonymous_user():
    """
    Anonymous users should not be allowed to create threads on authenticated documents.
    """
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/",
        {
            "body": "test",
        },
    )
    assert response.status_code == 401


def test_api_documents_threads_authenticated_document_reader_role():
    """
    Authenticated users should not be allowed to create threads on authenticated
    documents with reader link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.READER,
    )

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/",
        {
            "body": "test",
        },
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "link_role", [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
)
def test_api_documents_threads_authenticated_document(link_role):
    """
    Authenticated users should be allowed to create threads on authenticated
    documents with commenter or editor link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=link_role,
    )

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/",
        {
            "body": "test",
        },
    )

    assert response.status_code == 201
    thread = models.Thread.objects.first()
    comment = thread.comments.first()
    content = response.json()
    assert content == {
        "id": str(thread.id),
        "created_at": thread.created_at.isoformat().replace("+00:00", "Z"),
        "updated_at": thread.updated_at.isoformat().replace("+00:00", "Z"),
        "creator": {
            "full_name": user.full_name,
            "short_name": user.short_name,
        },
        "comments": [
            {
                "id": str(comment.id),
                "body": "test",
                "created_at": comment.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": user.full_name,
                    "short_name": user.short_name,
                },
                "reactions": [],
                "abilities": {
                    "destroy": True,
                    "update": True,
                    "partial_update": True,
                    "reactions": True,
                    "retrieve": True,
                },
            }
        ],
        "abilities": {
            "destroy": True,
            "update": True,
            "partial_update": True,
            "resolve": True,
            "retrieve": True,
        },
        "metadata": {},
        "resolved": False,
        "resolved_at": None,
        "resolved_by": None,
    }


# List


def test_api_documents_threads_list_public_document_link_role_reader():
    """
    Anonymous users should not be allowed to retrieve threads on public documents with reader
    link_role.
    """
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=models.LinkRoleChoices.READER,
    )

    factories.ThreadFactory.create_batch(3, document=document)

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/",
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "link_role", [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
)
def test_api_documents_threads_list_public_document_link_role_higher_than_reader(
    link_role,
):
    """
    Anonymous users should be allowed to retrieve threads on public documents with commenter or
    editor link_role.
    """
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=link_role,
    )

    factories.ThreadFactory.create_batch(3, document=document)

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/",
    )
    assert response.status_code == 200
    assert response.json()["count"] == 3


def test_api_documents_threads_list_authenticated_document_anonymous_user():
    """
    Anonymous users should not be allowed to retrieve threads on authenticated documents.
    """
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    factories.ThreadFactory.create_batch(3, document=document)

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/",
    )
    assert response.status_code == 401


def test_api_documents_threads_list_authenticated_document_reader_role():
    """
    Authenticated users should not be allowed to retrieve threads on authenticated
    documents with reader link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.READER,
    )

    factories.ThreadFactory.create_batch(3, document=document)

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "link_role", [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
)
def test_api_documents_threads_list_authenticated_document(link_role):
    """
    Authenticated users should be allowed to retrieve threads on authenticated
    documents with commenter or editor link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=link_role,
    )

    factories.ThreadFactory.create_batch(3, document=document)

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/",
    )
    assert response.status_code == 200
    assert response.json()["count"] == 3


def test_api_documents_threads_list_restricted_document_anonymous_user():
    """
    Anonymous users should not be allowed to retrieve threads on restricted documents.
    """
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    factories.ThreadFactory.create_batch(3, document=document)

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/",
    )
    assert response.status_code == 401


def test_api_documents_threads_list_restricted_document_reader_role():
    """
    Authenticated users should not be allowed to retrieve threads on restricted
    documents with reader roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.READER,
        users=[(user, models.LinkRoleChoices.READER)],
    )

    factories.ThreadFactory.create_batch(3, document=document)

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "role",
    [role for role in models.RoleChoices.values if role != models.RoleChoices.READER],
)
def test_api_documents_threads_list_restricted_document_editor(role):
    """
    Authenticated users should be allowed to retrieve threads on restricted
    documents with editor roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.EDITOR,
        users=[(user, role)],
    )

    factories.ThreadFactory.create_batch(3, document=document)

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/",
    )
    assert response.status_code == 200
    assert response.json()["count"] == 3


# Retrieve


def test_api_documents_threads_retrieve_public_document_link_role_reader():
    """
    Anonymous users should not be allowed to retrieve threads on public documents with reader
    link_role.
    """
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=models.LinkRoleChoices.READER,
    )

    thread = factories.ThreadFactory(document=document)

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "link_role", [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
)
def test_api_documents_threads_retrieve_public_document_link_role_higher_than_reader(
    link_role,
):
    """
    Anonymous users should be allowed to retrieve threads on public documents with commenter or
    editor link_role.
    """
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=link_role,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    comment = factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 200
    content = response.json()
    assert content == {
        "id": str(thread.id),
        "created_at": thread.created_at.isoformat().replace("+00:00", "Z"),
        "updated_at": thread.updated_at.isoformat().replace("+00:00", "Z"),
        "creator": None,
        "comments": [
            {
                "id": str(comment.id),
                "body": comment.body,
                "created_at": comment.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment.updated_at.isoformat().replace("+00:00", "Z"),
                "user": None,
                "reactions": [],
                "abilities": {
                    "destroy": False,
                    "update": False,
                    "partial_update": False,
                    "reactions": False,
                    "retrieve": True,
                },
            }
        ],
        "abilities": {
            "destroy": False,
            "update": False,
            "partial_update": False,
            "resolve": False,
            "retrieve": True,
        },
        "metadata": {},
        "resolved": False,
        "resolved_at": None,
        "resolved_by": None,
    }


def test_api_documents_threads_retrieve_authenticated_document_anonymous_user():
    """
    Anonymous users should not be allowed to retrieve threads on authenticated documents.
    """
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document)

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 401


def test_api_documents_threads_retrieve_authenticated_document_reader_role():
    """
    Authenticated users should not be allowed to retrieve threads on authenticated
    documents with reader link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.READER,
    )

    thread = factories.ThreadFactory(document=document)

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "link_role", [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
)
def test_api_documents_threads_retrieve_authenticated_document(link_role):
    """
    Authenticated users should be allowed to retrieve threads on authenticated
    documents with commenter or editor link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=link_role,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    comment = factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 200
    content = response.json()
    assert content == {
        "id": str(thread.id),
        "created_at": thread.created_at.isoformat().replace("+00:00", "Z"),
        "updated_at": thread.updated_at.isoformat().replace("+00:00", "Z"),
        "creator": None,
        "metadata": {},
        "resolved": False,
        "resolved_at": None,
        "resolved_by": None,
        "comments": [
            {
                "id": str(comment.id),
                "body": comment.body,
                "created_at": comment.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment.updated_at.isoformat().replace("+00:00", "Z"),
                "user": None,
                "reactions": [],
                "abilities": {
                    "destroy": False,
                    "update": False,
                    "partial_update": False,
                    "reactions": True,
                    "retrieve": True,
                },
            }
        ],
        "abilities": {
            "destroy": False,
            "update": False,
            "partial_update": False,
            "resolve": False,
            "retrieve": True,
        },
    }


def test_api_documents_threads_retrieve_restricted_document_anonymous_user():
    """
    Anonymous users should not be allowed to retrieve threads on restricted documents.
    """
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document)

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 401


def test_api_documents_threads_retrieve_restricted_document_reader_role():
    """
    Authenticated users should not be allowed to retrieve threads on restricted
    documents with reader roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.READER,
        users=[(user, models.LinkRoleChoices.READER)],
    )

    thread = factories.ThreadFactory(document=document)

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "role", [models.RoleChoices.COMMENTER, models.RoleChoices.EDITOR]
)
def test_api_documents_threads_retrieve_restricted_document_editor(role):
    """
    Authenticated users should be allowed to retrieve threads on restricted
    documents with editor roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.EDITOR,
        users=[(user, role)],
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    comment = factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 200
    content = response.json()
    assert content == {
        "id": str(thread.id),
        "created_at": thread.created_at.isoformat().replace("+00:00", "Z"),
        "updated_at": thread.updated_at.isoformat().replace("+00:00", "Z"),
        "creator": None,
        "comments": [
            {
                "id": str(comment.id),
                "body": comment.body,
                "created_at": comment.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment.updated_at.isoformat().replace("+00:00", "Z"),
                "user": None,
                "reactions": [],
                "abilities": {
                    "destroy": False,
                    "update": False,
                    "partial_update": False,
                    "reactions": True,
                    "retrieve": True,
                },
            }
        ],
        "abilities": {
            "destroy": False,
            "update": False,
            "partial_update": False,
            "resolve": False,
            "retrieve": True,
        },
        "metadata": {},
        "resolved": False,
        "resolved_at": None,
        "resolved_by": None,
    }


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_api_documents_threads_retrieve_restricted_document_privileged_roles(role):
    """
    Authenticated users with privileged roles should be allowed to retrieve
    threads on restricted documents with editor roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.EDITOR,
        users=[(user, role)],
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    comment = factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 200
    content = response.json()
    assert content == {
        "id": str(thread.id),
        "created_at": thread.created_at.isoformat().replace("+00:00", "Z"),
        "updated_at": thread.updated_at.isoformat().replace("+00:00", "Z"),
        "creator": None,
        "comments": [
            {
                "id": str(comment.id),
                "body": comment.body,
                "created_at": comment.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment.updated_at.isoformat().replace("+00:00", "Z"),
                "user": None,
                "reactions": [],
                "abilities": {
                    "destroy": True,
                    "update": True,
                    "partial_update": True,
                    "reactions": True,
                    "retrieve": True,
                },
            }
        ],
        "abilities": {
            "destroy": True,
            "update": True,
            "partial_update": True,
            "resolve": True,
            "retrieve": True,
        },
        "metadata": {},
        "resolved": False,
        "resolved_at": None,
        "resolved_by": None,
    }


# Destroy


def test_api_documents_threads_destroy_public_document_anonymous_user():
    """
    Anonymous users should not be allowed to destroy threads on public documents.
    """
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 401


def test_api_documents_threads_destroy_public_document_authenticated_user():
    """
    Authenticated users should not be allowed to destroy threads on public documents.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 403


def test_api_documents_threads_destroy_authenticated_document_anonymous_user():
    """
    Anonymous users should not be allowed to destroy threads on authenticated documents.
    """
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 401


def test_api_documents_threads_destroy_authenticated_document_reader_role():
    """
    Authenticated users should not be allowed to destroy threads on authenticated
    documents with reader link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.READER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "link_role", [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
)
def test_api_documents_threads_destroy_authenticated_document(link_role):
    """
    Authenticated users should not be allowed to destroy threads on authenticated
    documents with commenter or editor link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=link_role,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 403


def test_api_documents_threads_destroy_restricted_document_anonymous_user():
    """
    Anonymous users should not be allowed to destroy threads on restricted documents.
    """
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 401


def test_api_documents_threads_destroy_restricted_document_reader_role():
    """
    Authenticated users should not be allowed to destroy threads on restricted
    documents with reader roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.READER,
        users=[(user, models.LinkRoleChoices.READER)],
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "role", [models.RoleChoices.COMMENTER, models.RoleChoices.EDITOR]
)
def test_api_documents_threads_destroy_restricted_document_editor(role):
    """
    Authenticated users should not be allowed to destroy threads on restricted
    documents with editor roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.EDITOR,
        users=[(user, role)],
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_api_documents_threads_destroy_restricted_document_privileged_roles(role):
    """
    Authenticated users with privileged roles should be allowed to destroy
    threads on restricted documents with editor roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.EDITOR,
        users=[(user, role)],
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/",
    )
    assert response.status_code == 204
    assert not models.Thread.objects.filter(id=thread.id).exists()


# Resolve


def test_api_documents_threads_resolve_public_document_anonymous_user():
    """
    Anonymous users should not be allowed to resolve threads on public documents.
    """
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/resolve/",
    )
    assert response.status_code == 401


def test_api_documents_threads_resolve_public_document_authenticated_user():
    """
    Authenticated users should not be allowed to resolve threads on public documents.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="public",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/resolve/",
    )
    assert response.status_code == 403


def test_api_documents_threads_resolve_authenticated_document_anonymous_user():
    """
    Anonymous users should not be allowed to resolve threads on authenticated documents.
    """
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/resolve/",
    )
    assert response.status_code == 401


def test_api_documents_threads_resolve_authenticated_document_reader_role():
    """
    Authenticated users should not be allowed to resolve threads on authenticated
    documents with reader link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=models.LinkRoleChoices.READER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/resolve/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "link_role", [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
)
def test_api_documents_threads_resolve_authenticated_document(link_role):
    """
    Authenticated users should not be allowed to resolve threads on authenticated documents with
    commenter or editor link_role.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated",
        link_role=link_role,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/resolve/",
    )
    assert response.status_code == 403


def test_api_documents_threads_resolve_restricted_document_anonymous_user():
    """
    Anonymous users should not be allowed to resolve threads on restricted documents.
    """
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.COMMENTER,
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/resolve/",
    )
    assert response.status_code == 401


def test_api_documents_threads_resolve_restricted_document_reader_role():
    """
    Authenticated users should not be allowed to resolve threads on restricted documents with
    reader roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.READER,
        users=[(user, models.LinkRoleChoices.READER)],
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/resolve/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "role", [models.RoleChoices.COMMENTER, models.RoleChoices.EDITOR]
)
def test_api_documents_threads_resolve_restricted_document_editor(role):
    """
    Authenticated users should not be allowed to resolve threads on restricted documents with
    editor roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.EDITOR,
        users=[(user, role)],
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/resolve/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_api_documents_threads_resolve_restricted_document_privileged_roles(role):
    """
    Authenticated users with privileged roles should be allowed to resolve threads on
    restricted documents with editor roles.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        link_role=models.LinkRoleChoices.EDITOR,
        users=[(user, role)],
    )

    thread = factories.ThreadFactory(document=document, creator=None)
    factories.CommentFactory(thread=thread, user=None)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/resolve/",
    )
    assert response.status_code == 204

    # Verify thread is resolved
    thread.refresh_from_db()
    assert thread.resolved is True
    assert thread.resolved_at is not None
    assert thread.resolved_by == user
