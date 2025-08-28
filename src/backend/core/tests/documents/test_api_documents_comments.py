"""Test API for comments on documents."""

import random

from django.contrib.auth.models import AnonymousUser

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

# List comments


def test_list_comments_anonymous_user_public_document():
    """Anonymous users should be allowed to list comments on a public document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTATOR
    )
    comment1, comment2 = factories.CommentFactory.create_batch(2, document=document)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/comments/")
    assert response.status_code == 200
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": str(comment2.id),
                "content": comment2.content,
                "created_at": comment2.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment2.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": comment2.user.full_name,
                    "short_name": comment2.user.short_name,
                },
                "document": str(comment2.document.id),
                "abilities": comment2.get_abilities(AnonymousUser()),
            },
            {
                "id": str(comment1.id),
                "content": comment1.content,
                "created_at": comment1.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment1.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": comment1.user.full_name,
                    "short_name": comment1.user.short_name,
                },
                "document": str(comment1.document.id),
                "abilities": comment1.get_abilities(AnonymousUser()),
            },
        ],
    }


@pytest.mark.parametrize("link_reach", ["restricted", "authenticated"])
def test_list_comments_anonymous_user_non_public_document(link_reach):
    """Anonymous users should not be allowed to list comments on a non-public document."""
    document = factories.DocumentFactory(
        link_reach=link_reach, link_role=models.LinkRoleChoices.COMMENTATOR
    )
    factories.CommentFactory(document=document)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/comments/")
    assert response.status_code == 401


def test_list_comments_authenticated_user_accessible_document():
    """Authenticated users should be allowed to list comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTATOR)]
    )
    comment1 = factories.CommentFactory(document=document)
    comment2 = factories.CommentFactory(document=document, user=user)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/comments/")
    assert response.status_code == 200
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": str(comment2.id),
                "content": comment2.content,
                "created_at": comment2.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment2.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": comment2.user.full_name,
                    "short_name": comment2.user.short_name,
                },
                "document": str(comment2.document.id),
                "abilities": comment2.get_abilities(user),
            },
            {
                "id": str(comment1.id),
                "content": comment1.content,
                "created_at": comment1.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment1.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": comment1.user.full_name,
                    "short_name": comment1.user.short_name,
                },
                "document": str(comment1.document.id),
                "abilities": comment1.get_abilities(user),
            },
        ],
    }


def test_list_comments_authenticated_user_non_accessible_document():
    """Authenticated users should not be allowed to list comments on a non-accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.CommentFactory(document=document)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/comments/")
    assert response.status_code == 403


def test_list_comments_authenticated_user_not_enough_access():
    """
    Authenticated users should not be allowed to list comments on a document they don't have
    comment access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.READER)]
    )
    factories.CommentFactory(document=document)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/comments/")
    assert response.status_code == 403


# Create comment


def test_create_comment_anonymous_user_public_document():
    """Anonymous users should not be allowed to create comments on a public document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTATOR
    )
    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/comments/", {"content": "test"}
    )

    assert response.status_code == 201

    assert response.json() == {
        "id": str(response.json()["id"]),
        "content": "test",
        "created_at": response.json()["created_at"],
        "updated_at": response.json()["updated_at"],
        "user": None,
        "document": str(document.id),
        "abilities": {
            "destroy": False,
            "update": False,
            "partial_update": False,
            "retrieve": True,
        },
    }


def test_create_comment_anonymous_user_non_accessible_document():
    """Anonymous users should not be allowed to create comments on a non-accessible document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.READER
    )
    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/comments/", {"content": "test"}
    )

    assert response.status_code == 401


def test_create_comment_authenticated_user_accessible_document():
    """Authenticated users should be allowed to create comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTATOR)]
    )
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/comments/", {"content": "test"}
    )
    assert response.status_code == 201

    assert response.json() == {
        "id": str(response.json()["id"]),
        "content": "test",
        "created_at": response.json()["created_at"],
        "updated_at": response.json()["updated_at"],
        "user": {
            "full_name": user.full_name,
            "short_name": user.short_name,
        },
        "document": str(document.id),
        "abilities": {
            "destroy": True,
            "update": True,
            "partial_update": True,
            "retrieve": True,
        },
    }


def test_create_comment_authenticated_user_not_enough_access():
    """
    Authenticated users should not be allowed to create comments on a document they don't have
    comment access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.READER)]
    )
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/comments/", {"content": "test"}
    )
    assert response.status_code == 403


# Retrieve comment


def test_retrieve_comment_anonymous_user_public_document():
    """Anonymous users should be allowed to retrieve comments on a public document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTATOR
    )
    comment = factories.CommentFactory(document=document)
    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": str(comment.id),
        "content": comment.content,
        "created_at": comment.created_at.isoformat().replace("+00:00", "Z"),
        "updated_at": comment.updated_at.isoformat().replace("+00:00", "Z"),
        "user": {
            "full_name": comment.user.full_name,
            "short_name": comment.user.short_name,
        },
        "document": str(comment.document.id),
        "abilities": comment.get_abilities(AnonymousUser()),
    }


def test_retrieve_comment_anonymous_user_non_accessible_document():
    """Anonymous users should not be allowed to retrieve comments on a non-accessible document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.READER
    )
    comment = factories.CommentFactory(document=document)
    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 401


def test_retrieve_comment_authenticated_user_accessible_document():
    """Authenticated users should be allowed to retrieve comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTATOR)]
    )
    comment = factories.CommentFactory(document=document)
    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 200


def test_retrieve_comment_authenticated_user_not_enough_access():
    """
    Authenticated users should not be allowed to retrieve comments on a document they don't have
    comment access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.READER)]
    )
    comment = factories.CommentFactory(document=document)
    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 403


# Update comment


def test_update_comment_anonymous_user_public_document():
    """Anonymous users should not be allowed to update comments on a public document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTATOR
    )
    comment = factories.CommentFactory(document=document, content="test")
    client = APIClient()
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/",
        {"content": "other content"},
    )
    assert response.status_code == 401


def test_update_comment_anonymous_user_non_accessible_document():
    """Anonymous users should not be allowed to update comments on a non-accessible document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.READER
    )
    comment = factories.CommentFactory(document=document, content="test")
    client = APIClient()
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/",
        {"content": "other content"},
    )
    assert response.status_code == 401


def test_update_comment_authenticated_user_accessible_document():
    """Authenticated users should not be able to update comments not their own."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        users=[
            (
                user,
                random.choice(
                    [models.LinkRoleChoices.COMMENTATOR, models.LinkRoleChoices.EDITOR]
                ),
            )
        ],
    )
    comment = factories.CommentFactory(document=document, content="test")
    client = APIClient()
    client.force_login(user)
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/",
        {"content": "other content"},
    )
    assert response.status_code == 403


def test_update_comment_authenticated_user_own_comment():
    """Authenticated users should be able to update comments not their own."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        users=[
            (
                user,
                random.choice(
                    [models.LinkRoleChoices.COMMENTATOR, models.LinkRoleChoices.EDITOR]
                ),
            )
        ],
    )
    comment = factories.CommentFactory(document=document, content="test", user=user)
    client = APIClient()
    client.force_login(user)
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/",
        {"content": "other content"},
    )
    assert response.status_code == 200

    comment.refresh_from_db()
    assert comment.content == "other content"


def test_update_comment_authenticated_user_not_enough_access():
    """
    Authenticated users should not be allowed to update comments on a document they don't
    have comment access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.READER)]
    )
    comment = factories.CommentFactory(document=document, content="test")
    client = APIClient()
    client.force_login(user)
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/",
        {"content": "other content"},
    )
    assert response.status_code == 403


def test_update_comment_authenticated_no_access():
    """
    Authenticated users should not be allowed to update comments on a document they don't
    have access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    comment = factories.CommentFactory(document=document, content="test")
    client = APIClient()
    client.force_login(user)
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/",
        {"content": "other content"},
    )
    assert response.status_code == 403


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_update_comment_authenticated_admin_or_owner_can_update_any_comment(role):
    """
    Authenticated users should be able to update comments on a document they don't have access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, role)])
    comment = factories.CommentFactory(document=document, content="test")
    client = APIClient()
    client.force_login(user)

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/",
        {"content": "other content"},
    )
    assert response.status_code == 200

    comment.refresh_from_db()
    assert comment.content == "other content"


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_update_comment_authenticated_admin_or_owner_can_update_own_comment(role):
    """
    Authenticated users should be able to update comments on a document they don't have access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, role)])
    comment = factories.CommentFactory(document=document, content="test", user=user)
    client = APIClient()
    client.force_login(user)

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/",
        {"content": "other content"},
    )
    assert response.status_code == 200

    comment.refresh_from_db()
    assert comment.content == "other content"


# Delete comment


def test_delete_comment_anonymous_user_public_document():
    """Anonymous users should not be allowed to delete comments on a public document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTATOR
    )
    comment = factories.CommentFactory(document=document)
    client = APIClient()
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 401


def test_delete_comment_anonymous_user_non_accessible_document():
    """Anonymous users should not be allowed to delete comments on a non-accessible document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.READER
    )
    comment = factories.CommentFactory(document=document)
    client = APIClient()
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 401


def test_delete_comment_authenticated_user_accessible_document_own_comment():
    """Authenticated users should be able to delete comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTATOR)]
    )
    comment = factories.CommentFactory(document=document, user=user)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 204


def test_delete_comment_authenticated_user_accessible_document_not_own_comment():
    """Authenticated users should not be able to delete comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTATOR)]
    )
    comment = factories.CommentFactory(document=document)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 403


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_delete_comment_authenticated_user_admin_or_owner_can_delete_any_comment(role):
    """Authenticated users should be able to delete comments on a document they have access to."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, role)])
    comment = factories.CommentFactory(document=document)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 204


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_delete_comment_authenticated_user_admin_or_owner_can_delete_own_comment(role):
    """Authenticated users should be able to delete comments on a document they have access to."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, role)])
    comment = factories.CommentFactory(document=document, user=user)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 204


def test_delete_comment_authenticated_user_not_enough_access():
    """
    Authenticated users should not be able to delete comments on a document they don't
    have access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.READER)]
    )
    comment = factories.CommentFactory(document=document)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 403
