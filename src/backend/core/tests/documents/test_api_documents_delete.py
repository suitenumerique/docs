"""
Tests for Documents API endpoint in impress's core app: delete
"""

from unittest import mock

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tests.conftest import TEAM, USER, VIA
from core.utils.analytics import PosthogEventName

pytestmark = pytest.mark.django_db


def test_api_documents_delete_anonymous():
    """Anonymous users should not be allowed to destroy a document."""
    document = factories.DocumentFactory()

    response = APIClient().delete(
        f"/api/v1.0/documents/{document.id!s}/",
    )

    assert response.status_code == 401
    assert models.Document.objects.count() == 1


@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
def test_api_documents_delete_authenticated_unrelated(reach, role):
    """
    Authenticated users should not be allowed to delete a document to which
    they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)

    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/",
    )

    assert response.status_code == 403
    assert models.Document.objects.count() == 2


@pytest.mark.parametrize("role", ["reader", "editor", "administrator"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_delete_authenticated_not_owner(via, role, mock_user_teams):
    """
    Authenticated users should not be allowed to delete a document for which they are
    only a reader, editor or administrator.
    """
    user = factories.UserFactory(with_owned_document=True)

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

    response = client.delete(
        f"/api/v1.0/documents/{document.id}/",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    assert models.Document.objects.count() == 2


def _create_restricted_tree_with_creator_subpage(owner, creator, with_grandchild=True):
    """
    Create a restricted document owned by `owner`, a subpage created by
    `creator` under it and, unless `with_grandchild` is False, a page written
    by someone else under that subpage.
    """
    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        users=[(owner, "owner")],
    )
    subpage = factories.DocumentFactory(
        parent=document,
        creator=creator,
        link_reach=models.LinkReachChoices.RESTRICTED,
    )
    grandchild = (
        factories.DocumentFactory(
            parent=subpage,
            creator=owner,
            link_reach=models.LinkReachChoices.RESTRICTED,
        )
        if with_grandchild
        else None
    )
    return document, subpage, grandchild


def test_api_documents_delete_removed_creator():
    """
    A user whose access to the document was removed must no longer be able to
    destroy the subpage they created under it, even without children.
    Regression test for the improper access control reported on the bug
    bounty program.
    """
    owner = factories.UserFactory()
    creator = factories.UserFactory()
    _document, subpage, _grandchild = _create_restricted_tree_with_creator_subpage(
        owner, creator, with_grandchild=False
    )

    client = APIClient()
    client.force_login(creator)

    response = client.delete(f"/api/v1.0/documents/{subpage.id!s}/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    subpage.refresh_from_db()
    assert subpage.deleted_at is None


@pytest.mark.parametrize("role", ["reader", "commenter"])
def test_api_documents_delete_downgraded_creator(role):
    """
    A creator whose access was downgraded to a role that can not create
    subpages must no longer be able to destroy the subpage they created,
    even without children.
    """
    owner = factories.UserFactory()
    creator = factories.UserFactory()
    document, subpage, _grandchild = _create_restricted_tree_with_creator_subpage(
        owner, creator, with_grandchild=False
    )
    factories.UserDocumentAccessFactory(document=document, user=creator, role=role)

    client = APIClient()
    client.force_login(creator)

    response = client.delete(f"/api/v1.0/documents/{subpage.id!s}/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    subpage.refresh_from_db()
    assert subpage.deleted_at is None


def test_api_documents_delete_creator_with_access_is_kept():
    """
    The creator of a subpage without children who still holds access
    (e.g. editor) must keep the ability to destroy it: this is the behavior
    PR #1297 introduced and the fix must not regress it.
    """
    owner = factories.UserFactory()
    creator = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        users=[(owner, "owner")],
    )
    subpage = factories.DocumentFactory(
        parent=document,
        creator=creator,
        link_reach=models.LinkReachChoices.RESTRICTED,
    )
    factories.UserDocumentAccessFactory(document=document, user=creator, role="editor")

    client = APIClient()
    client.force_login(creator)

    response = client.delete(f"/api/v1.0/documents/{subpage.id!s}/")

    assert response.status_code == 204
    subpage.refresh_from_db()
    assert subpage.deleted_at is not None


def test_api_documents_delete_creator_with_children():
    """
    The creator of a subpage who still holds an editor access must not be able
    to destroy it once it has children, while the owner of the document can.
    """
    owner = factories.UserFactory()
    creator = factories.UserFactory()
    document, subpage, grandchild = _create_restricted_tree_with_creator_subpage(
        owner, creator
    )
    factories.UserDocumentAccessFactory(document=document, user=creator, role="editor")

    client = APIClient()
    client.force_login(creator)

    response = client.delete(f"/api/v1.0/documents/{subpage.id!s}/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    subpage.refresh_from_db()
    grandchild.refresh_from_db()
    assert subpage.deleted_at is None
    assert grandchild.ancestors_deleted_at is None

    client.force_login(owner)

    response = client.delete(f"/api/v1.0/documents/{subpage.id!s}/")

    assert response.status_code == 204
    subpage.refresh_from_db()
    grandchild.refresh_from_db()
    assert subpage.deleted_at is not None
    assert grandchild.ancestors_deleted_at == subpage.deleted_at


def test_api_documents_delete_creator_children_in_trashbin():
    """
    Children in the trashbin do not count: once its only child is deleted, the
    creator of a subpage can destroy it again.
    """
    owner = factories.UserFactory()
    creator = factories.UserFactory()
    document, subpage, grandchild = _create_restricted_tree_with_creator_subpage(
        owner, creator
    )
    factories.UserDocumentAccessFactory(document=document, user=creator, role="editor")
    grandchild.soft_delete()

    client = APIClient()
    client.force_login(creator)

    response = client.delete(f"/api/v1.0/documents/{subpage.id!s}/")

    assert response.status_code == 204
    subpage.refresh_from_db()
    assert subpage.deleted_at is not None


def test_api_documents_delete_creator_child_added_after_permission_check():
    """
    A child created by someone else between the permission check and the
    deletion must make the deletion of the creator fail, without deleting
    anything: nothing is locked, so the deletion is checked again afterwards.
    """
    owner = factories.UserFactory()
    creator = factories.UserFactory()
    document, subpage, _ = _create_restricted_tree_with_creator_subpage(
        owner, creator, with_grandchild=False
    )
    factories.UserDocumentAccessFactory(document=document, user=creator, role="editor")

    concurrent_children = []
    get_abilities = models.Document.get_abilities

    def get_abilities_then_concurrent_child(instance, user):
        abilities = get_abilities(instance, user)
        if not concurrent_children:
            # Another request adds the child, on its own instance of the subpage
            concurrent_children.append(
                factories.DocumentFactory(
                    parent=models.Document.objects.get(pk=instance.pk),
                    creator=owner,
                    link_reach=models.LinkReachChoices.RESTRICTED,
                )
            )
        return abilities

    client = APIClient()
    client.force_login(creator)

    with mock.patch.object(
        models.Document,
        "get_abilities",
        autospec=True,
        side_effect=get_abilities_then_concurrent_child,
    ):
        response = client.delete(f"/api/v1.0/documents/{subpage.id!s}/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    assert len(concurrent_children) == 1
    child = concurrent_children[0]
    subpage.refresh_from_db()
    child.refresh_from_db()
    assert subpage.deleted_at is None
    assert subpage.ancestors_deleted_at is None
    assert subpage.numchild == 1
    assert child.ancestors_deleted_at is None


@pytest.mark.parametrize("depth", [1, 2, 3])
def test_api_documents_delete_authenticated_owner_of_ancestor(depth):
    """
    Authenticated users should not be able to delete a document for which
    they are only owner of an ancestor.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    documents = []
    for i in range(depth):
        documents.append(
            factories.UserDocumentAccessFactory(role="owner", user=user).document
            if i == 0
            else factories.DocumentFactory(parent=documents[-1])
        )
    assert models.Document.objects.count() == depth

    response = client.delete(
        f"/api/v1.0/documents/{documents[-1].id}/",
    )

    assert response.status_code == 204

    # Make sure it is only a soft delete
    assert models.Document.objects.count() == depth
    assert models.Document.objects.filter(deleted_at__isnull=True).count() == depth - 1
    assert models.Document.objects.filter(deleted_at__isnull=False).count() == 1


@pytest.mark.parametrize("via", VIA)
def test_api_documents_delete_authenticated_owner(via, mock_user_teams):
    """
    Authenticated users should be able to delete a document they own.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role="owner")
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="owner"
        )

    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.delete(
            f"/api/v1.0/documents/{document.id}/",
        )

    assert response.status_code == 204

    # Make sure it is only a soft delete
    assert models.Document.objects.count() == 1
    assert models.Document.objects.filter(deleted_at__isnull=True).exists() is False
    assert models.Document.objects.filter(deleted_at__isnull=False).count() == 1

    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_DELETED,
        user,
        {},
        document=document,
    )


def test_api_documents_delete_reset_yhub_service(
    mock_reset_service_connections, capture_service_resets
):
    """Deleting a document must reset the connection on the collaboration server."""

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])

    with capture_service_resets():
        response = client.delete(
            f"/api/v1.0/documents/{document.id}/",
        )

    assert response.status_code == 204

    # Make sure the reset service connection is called
    mock_reset_service_connections.assert_called_once_with(str(document.id), None)
