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
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTER
    )
    thread = factories.ThreadFactory(document=document)
    comment1, comment2 = factories.CommentFactory.create_batch(2, thread=thread)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/"
    )
    assert response.status_code == 200
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": str(comment1.id),
                "body": comment1.body,
                "created_at": comment1.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment1.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": comment1.user.full_name,
                    "short_name": comment1.user.short_name,
                },
                "abilities": comment1.get_abilities(AnonymousUser()),
                "reactions": [],
            },
            {
                "id": str(comment2.id),
                "body": comment2.body,
                "created_at": comment2.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment2.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": comment2.user.full_name,
                    "short_name": comment2.user.short_name,
                },
                "abilities": comment2.get_abilities(AnonymousUser()),
                "reactions": [],
            },
        ],
    }


@pytest.mark.parametrize("link_reach", ["restricted", "authenticated"])
def test_list_comments_anonymous_user_non_public_document(link_reach):
    """Anonymous users should not be allowed to list comments on a non-public document."""
    document = factories.DocumentFactory(
        link_reach=link_reach, link_role=models.LinkRoleChoices.COMMENTER
    )
    thread = factories.ThreadFactory(document=document)
    factories.CommentFactory(thread=thread)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/"
    )
    assert response.status_code == 401


def test_list_comments_authenticated_user_accessible_document():
    """Authenticated users should be allowed to list comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTER)]
    )
    thread = factories.ThreadFactory(document=document)
    comment1 = factories.CommentFactory(thread=thread)
    comment2 = factories.CommentFactory(thread=thread, user=user)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    client = APIClient()
    client.force_login(user)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/"
    )
    assert response.status_code == 200
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": str(comment1.id),
                "body": comment1.body,
                "created_at": comment1.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment1.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": comment1.user.full_name,
                    "short_name": comment1.user.short_name,
                },
                "abilities": comment1.get_abilities(user),
                "reactions": [],
            },
            {
                "id": str(comment2.id),
                "body": comment2.body,
                "created_at": comment2.created_at.isoformat().replace("+00:00", "Z"),
                "updated_at": comment2.updated_at.isoformat().replace("+00:00", "Z"),
                "user": {
                    "full_name": comment2.user.full_name,
                    "short_name": comment2.user.short_name,
                },
                "abilities": comment2.get_abilities(user),
                "reactions": [],
            },
        ],
    }


def test_list_comments_authenticated_user_non_accessible_document():
    """Authenticated users should not be allowed to list comments on a non-accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    thread = factories.ThreadFactory(document=document)
    factories.CommentFactory(thread=thread)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    client = APIClient()
    client.force_login(user)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/"
    )
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
    thread = factories.ThreadFactory(document=document)
    factories.CommentFactory(thread=thread)
    # other comments not linked to the document
    factories.CommentFactory.create_batch(2)

    client = APIClient()
    client.force_login(user)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/"
    )
    assert response.status_code == 403


# Create comment


def test_create_comment_anonymous_user_public_document():
    """
    Anonymous users should be allowed to create comments on a public document
    with commenter link_role.
    """
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTER
    )
    thread = factories.ThreadFactory(document=document)
    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/",
        {"body": "test"},
    )
    assert response.status_code == 201

    assert response.json() == {
        "id": str(response.json()["id"]),
        "body": "test",
        "created_at": response.json()["created_at"],
        "updated_at": response.json()["updated_at"],
        "user": None,
        "abilities": {
            "destroy": False,
            "update": False,
            "partial_update": False,
            "reactions": False,
            "retrieve": True,
        },
        "reactions": [],
    }


def test_create_comment_anonymous_user_non_accessible_document():
    """Anonymous users should not be allowed to create comments on a non-accessible document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.READER
    )
    thread = factories.ThreadFactory(document=document)
    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/",
        {"body": "test"},
    )

    assert response.status_code == 401


def test_create_comment_authenticated_user_accessible_document():
    """Authenticated users should be allowed to create comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTER)]
    )
    thread = factories.ThreadFactory(document=document)
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/",
        {"body": "test"},
    )
    assert response.status_code == 201

    assert response.json() == {
        "id": str(response.json()["id"]),
        "body": "test",
        "created_at": response.json()["created_at"],
        "updated_at": response.json()["updated_at"],
        "user": {
            "full_name": user.full_name,
            "short_name": user.short_name,
        },
        "abilities": {
            "destroy": True,
            "update": True,
            "partial_update": True,
            "reactions": True,
            "retrieve": True,
        },
        "reactions": [],
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
    thread = factories.ThreadFactory(document=document)
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/",
        {"body": "test"},
    )
    assert response.status_code == 403


# Retrieve comment


def test_retrieve_comment_anonymous_user_public_document():
    """Anonymous users should be allowed to retrieve comments on a public document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": str(comment.id),
        "body": comment.body,
        "created_at": comment.created_at.isoformat().replace("+00:00", "Z"),
        "updated_at": comment.updated_at.isoformat().replace("+00:00", "Z"),
        "user": {
            "full_name": comment.user.full_name,
            "short_name": comment.user.short_name,
        },
        "reactions": [],
        "abilities": comment.get_abilities(AnonymousUser()),
    }


def test_retrieve_comment_anonymous_user_non_accessible_document():
    """Anonymous users should not be allowed to retrieve comments on a non-accessible document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.READER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 401


def test_retrieve_comment_authenticated_user_accessible_document():
    """Authenticated users should be allowed to retrieve comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTER)]
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
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
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 403


# Update comment


def test_update_comment_anonymous_user_public_document():
    """Anonymous users should not be allowed to update comments on a public document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, body="test")
    client = APIClient()
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/",
        {"body": "other content"},
    )
    assert response.status_code == 401


def test_update_comment_anonymous_user_non_accessible_document():
    """Anonymous users should not be allowed to update comments on a non-accessible document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.READER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, body="test")
    client = APIClient()
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/",
        {"body": "other content"},
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
                    [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
                ),
            )
        ],
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, body="test")
    client = APIClient()
    client.force_login(user)
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/",
        {"body": "other content"},
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
                    [models.LinkRoleChoices.COMMENTER, models.LinkRoleChoices.EDITOR]
                ),
            )
        ],
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, body="test", user=user)
    client = APIClient()
    client.force_login(user)
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/",
        {"body": "other content"},
    )
    assert response.status_code == 200

    comment.refresh_from_db()
    assert comment.body == "other content"


def test_update_comment_authenticated_user_not_enough_access():
    """
    Authenticated users should not be allowed to update comments on a document they don't
    have comment access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.READER)]
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, body="test")
    client = APIClient()
    client.force_login(user)
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/",
        {"body": "other content"},
    )
    assert response.status_code == 403


def test_update_comment_authenticated_no_access():
    """
    Authenticated users should not be allowed to update comments on a document they don't
    have access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, body="test")
    client = APIClient()
    client.force_login(user)
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/",
        {"body": "other content"},
    )
    assert response.status_code == 403


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_update_comment_authenticated_admin_or_owner_can_update_any_comment(role):
    """
    Authenticated users should be able to update comments on a document they don't have access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, role)])
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, body="test")
    client = APIClient()
    client.force_login(user)

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/",
        {"body": "other content"},
    )
    assert response.status_code == 200

    comment.refresh_from_db()
    assert comment.body == "other content"


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_update_comment_authenticated_admin_or_owner_can_update_own_comment(role):
    """
    Authenticated users should be able to update comments on a document they don't have access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, role)])
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, body="test", user=user)
    client = APIClient()
    client.force_login(user)

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/",
        {"body": "other content"},
    )
    assert response.status_code == 200

    comment.refresh_from_db()
    assert comment.body == "other content"


# Delete comment


def test_delete_comment_anonymous_user_public_document():
    """Anonymous users should not be allowed to delete comments on a public document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 401


def test_delete_comment_anonymous_user_non_accessible_document():
    """Anonymous users should not be allowed to delete comments on a non-accessible document."""
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.READER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 401


def test_delete_comment_authenticated_user_accessible_document_own_comment():
    """Authenticated users should be able to delete comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTER)]
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, user=user)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 204


def test_delete_comment_authenticated_user_accessible_document_not_own_comment():
    """Authenticated users should not be able to delete comments on an accessible document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.LinkRoleChoices.COMMENTER)]
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 403


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_delete_comment_authenticated_user_admin_or_owner_can_delete_any_comment(role):
    """Authenticated users should be able to delete comments on a document they have access to."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, role)])
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 204


@pytest.mark.parametrize("role", [models.RoleChoices.ADMIN, models.RoleChoices.OWNER])
def test_delete_comment_authenticated_user_admin_or_owner_can_delete_own_comment(role):
    """Authenticated users should be able to delete comments on a document they have access to."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, role)])
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread, user=user)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
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
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/{comment.id!s}/"
    )
    assert response.status_code == 403


# Create reaction


@pytest.mark.parametrize("link_role", models.LinkRoleChoices.values)
def test_create_reaction_anonymous_user_public_document(link_role):
    """No matter the link_role, an anonymous user can not react to a comment."""

    document = factories.DocumentFactory(link_reach="public", link_role=link_role)
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": "test"},
    )
    assert response.status_code == 401


def test_create_reaction_authenticated_user_public_document():
    """
    Authenticated users should not be able to reaction to a comment on a public document with
    link_role reader.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.READER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": "test"},
    )
    assert response.status_code == 403


def test_create_reaction_authenticated_user_accessible_public_document():
    """
    Authenticated users should be able to react to a comment on a public document.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="public", link_role=models.LinkRoleChoices.COMMENTER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": "test"},
    )
    assert response.status_code == 201

    assert models.Reaction.objects.filter(
        comment=comment, emoji="test", users__in=[user]
    ).exists()


def test_create_reaction_authenticated_user_connected_document_link_role_reader():
    """
    Authenticated users should not be able to react to a comment on a connected document
    with link_role reader.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated", link_role=models.LinkRoleChoices.READER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": "test"},
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "link_role",
    [
        role
        for role in models.LinkRoleChoices.values
        if role != models.LinkRoleChoices.READER
    ],
)
def test_create_reaction_authenticated_user_connected_document(link_role):
    """
    Authenticated users should be able to react to a comment on a connected document.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="authenticated", link_role=link_role
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": "test"},
    )
    assert response.status_code == 201

    assert models.Reaction.objects.filter(
        comment=comment, emoji="test", users__in=[user]
    ).exists()


def test_create_reaction_authenticated_user_restricted_accessible_document():
    """
    Authenticated users should not be able to react to a comment on a restricted accessible document
    they don't have access to.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": "test"},
    )
    assert response.status_code == 403


def test_create_reaction_authenticated_user_restricted_accessible_document_role_reader():
    """
    Authenticated users should not be able to react to a comment on a restricted accessible
    document with role reader.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", link_role=models.LinkRoleChoices.READER
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": "test"},
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "role",
    [role for role in models.RoleChoices.values if role != models.RoleChoices.READER],
)
def test_create_reaction_authenticated_user_restricted_accessible_document_role_commenter(
    role,
):
    """
    Authenticated users should be able to react to a comment on a restricted accessible document
    with role commenter.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted", users=[(user, role)])
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": "test"},
    )
    assert response.status_code == 201

    assert models.Reaction.objects.filter(
        comment=comment, emoji="test", users__in=[user]
    ).exists()

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": "test"},
    )
    assert response.status_code == 400
    assert response.json() == {"user_already_reacted": True}


# Delete reaction


def test_delete_reaction_not_owned_by_the_current_user():
    """
    Users should not be able to delete reactions not owned by the current user.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.RoleChoices.ADMIN)]
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    reaction = factories.ReactionFactory(comment=comment)

    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": reaction.emoji},
    )
    assert response.status_code == 404


def test_delete_reaction_owned_by_the_current_user():
    """
    Users should not be able to delete reactions not owned by the current user.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(user, models.RoleChoices.ADMIN)]
    )
    thread = factories.ThreadFactory(document=document)
    comment = factories.CommentFactory(thread=thread)
    reaction = factories.ReactionFactory(comment=comment)

    client = APIClient()
    client.force_login(user)
    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/"
        f"comments/{comment.id!s}/reactions/",
        {"emoji": reaction.emoji},
    )
    assert response.status_code == 404

    reaction.refresh_from_db()
    assert reaction.users.exists()
