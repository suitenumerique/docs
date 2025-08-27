"""Test the comment model."""

import random

from django.contrib.auth.models import AnonymousUser

import pytest

from core import factories
from core.models import LinkReachChoices, LinkRoleChoices, RoleChoices

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "role,can_comment",
    [
        (LinkRoleChoices.READER, False),
        (LinkRoleChoices.COMMENTATOR, True),
        (LinkRoleChoices.EDITOR, True),
    ],
)
def test_comment_get_abilities_anonymous_user_public_document(role, can_comment):
    """Anonymous users cannot comment on a document."""
    document = factories.DocumentFactory(
        link_role=role, link_reach=LinkReachChoices.PUBLIC
    )
    comment = factories.CommentFactory(document=document)
    user = AnonymousUser()

    assert comment.get_abilities(user) == {
        "destroy": False,
        "update": False,
        "partial_update": False,
        "retrieve": can_comment,
    }


@pytest.mark.parametrize(
    "link_reach", [LinkReachChoices.RESTRICTED, LinkReachChoices.AUTHENTICATED]
)
def test_comment_get_abilities_anonymous_user_restricted_document(link_reach):
    """Anonymous users cannot comment on a restricted document."""
    document = factories.DocumentFactory(link_reach=link_reach)
    comment = factories.CommentFactory(document=document)
    user = AnonymousUser()

    assert comment.get_abilities(user) == {
        "destroy": False,
        "update": False,
        "partial_update": False,
        "retrieve": False,
    }


@pytest.mark.parametrize(
    "link_role,link_reach,can_comment",
    [
        (LinkRoleChoices.READER, LinkReachChoices.PUBLIC, False),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.PUBLIC, True),
        (LinkRoleChoices.EDITOR, LinkReachChoices.PUBLIC, True),
        (LinkRoleChoices.READER, LinkReachChoices.RESTRICTED, False),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.RESTRICTED, False),
        (LinkRoleChoices.EDITOR, LinkReachChoices.RESTRICTED, False),
        (LinkRoleChoices.READER, LinkReachChoices.AUTHENTICATED, False),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.AUTHENTICATED, True),
        (LinkRoleChoices.EDITOR, LinkReachChoices.AUTHENTICATED, True),
    ],
)
def test_comment_get_abilities_user_reader(link_role, link_reach, can_comment):
    """Readers cannot comment on a document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_role=link_role, link_reach=link_reach, users=[(user, RoleChoices.READER)]
    )
    comment = factories.CommentFactory(document=document)

    assert comment.get_abilities(user) == {
        "destroy": False,
        "update": False,
        "partial_update": False,
        "retrieve": can_comment,
    }


@pytest.mark.parametrize(
    "link_role,link_reach,can_comment",
    [
        (LinkRoleChoices.READER, LinkReachChoices.PUBLIC, False),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.PUBLIC, True),
        (LinkRoleChoices.EDITOR, LinkReachChoices.PUBLIC, True),
        (LinkRoleChoices.READER, LinkReachChoices.RESTRICTED, False),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.RESTRICTED, False),
        (LinkRoleChoices.EDITOR, LinkReachChoices.RESTRICTED, False),
        (LinkRoleChoices.READER, LinkReachChoices.AUTHENTICATED, False),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.AUTHENTICATED, True),
        (LinkRoleChoices.EDITOR, LinkReachChoices.AUTHENTICATED, True),
    ],
)
def test_comment_get_abilities_user_reader_own_comment(
    link_role, link_reach, can_comment
):
    """User with reader role on a document has all accesses to its own comment."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_role=link_role, link_reach=link_reach, users=[(user, RoleChoices.READER)]
    )
    comment = factories.CommentFactory(
        document=document, user=user if can_comment else None
    )

    assert comment.get_abilities(user) == {
        "destroy": can_comment,
        "update": can_comment,
        "partial_update": can_comment,
        "retrieve": can_comment,
    }


@pytest.mark.parametrize(
    "link_role,link_reach",
    [
        (LinkRoleChoices.READER, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.EDITOR, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.READER, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.EDITOR, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.READER, LinkReachChoices.AUTHENTICATED),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.AUTHENTICATED),
        (LinkRoleChoices.EDITOR, LinkReachChoices.AUTHENTICATED),
    ],
)
def test_comment_get_abilities_user_commentator(link_role, link_reach):
    """Commentators can comment on a document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_role=link_role,
        link_reach=link_reach,
        users=[(user, RoleChoices.COMMENTATOR)],
    )
    comment = factories.CommentFactory(document=document)

    assert comment.get_abilities(user) == {
        "destroy": False,
        "update": False,
        "partial_update": False,
        "retrieve": True,
    }


@pytest.mark.parametrize(
    "link_role,link_reach",
    [
        (LinkRoleChoices.READER, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.EDITOR, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.READER, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.EDITOR, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.READER, LinkReachChoices.AUTHENTICATED),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.AUTHENTICATED),
        (LinkRoleChoices.EDITOR, LinkReachChoices.AUTHENTICATED),
    ],
)
def test_comment_get_abilities_user_commentator_own_comment(link_role, link_reach):
    """Commentators have all accesses to its own comment."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_role=link_role,
        link_reach=link_reach,
        users=[(user, RoleChoices.COMMENTATOR)],
    )
    comment = factories.CommentFactory(document=document, user=user)

    assert comment.get_abilities(user) == {
        "destroy": True,
        "update": True,
        "partial_update": True,
        "retrieve": True,
    }


@pytest.mark.parametrize(
    "link_role,link_reach",
    [
        (LinkRoleChoices.READER, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.EDITOR, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.READER, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.EDITOR, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.READER, LinkReachChoices.AUTHENTICATED),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.AUTHENTICATED),
        (LinkRoleChoices.EDITOR, LinkReachChoices.AUTHENTICATED),
    ],
)
def test_comment_get_abilities_user_editor(link_role, link_reach):
    """Editors can comment on a document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_role=link_role, link_reach=link_reach, users=[(user, RoleChoices.EDITOR)]
    )
    comment = factories.CommentFactory(document=document)

    assert comment.get_abilities(user) == {
        "destroy": False,
        "update": False,
        "partial_update": False,
        "retrieve": True,
    }


@pytest.mark.parametrize(
    "link_role,link_reach",
    [
        (LinkRoleChoices.READER, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.EDITOR, LinkReachChoices.PUBLIC),
        (LinkRoleChoices.READER, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.EDITOR, LinkReachChoices.RESTRICTED),
        (LinkRoleChoices.READER, LinkReachChoices.AUTHENTICATED),
        (LinkRoleChoices.COMMENTATOR, LinkReachChoices.AUTHENTICATED),
        (LinkRoleChoices.EDITOR, LinkReachChoices.AUTHENTICATED),
    ],
)
def test_comment_get_abilities_user_editor_own_comment(link_role, link_reach):
    """Editors have all accesses to its own comment."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(
        link_role=link_role, link_reach=link_reach, users=[(user, RoleChoices.EDITOR)]
    )
    comment = factories.CommentFactory(document=document, user=user)

    assert comment.get_abilities(user) == {
        "destroy": True,
        "update": True,
        "partial_update": True,
        "retrieve": True,
    }


def test_comment_get_abilities_user_admin():
    """Admins have all accesses to a comment."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, RoleChoices.ADMIN)])
    comment = factories.CommentFactory(
        document=document, user=random.choice([user, None])
    )

    assert comment.get_abilities(user) == {
        "destroy": True,
        "update": True,
        "partial_update": True,
        "retrieve": True,
    }


def test_comment_get_abilities_user_owner():
    """Owners have all accesses to a comment."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, RoleChoices.OWNER)])
    comment = factories.CommentFactory(
        document=document, user=random.choice([user, None])
    )

    assert comment.get_abilities(user) == {
        "destroy": True,
        "update": True,
        "partial_update": True,
        "retrieve": True,
    }
