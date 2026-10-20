"""
Test moving documents within the document tree via an detail action API endpoint.
"""

from unittest import mock
from uuid import uuid4

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import enums, factories, models
from core.utils.analytics import PosthogEventName

pytestmark = pytest.mark.django_db


def test_api_documents_move_anonymous_user():
    """Anonymous users should not be able to move documents."""
    document = factories.DocumentFactory()
    target = factories.DocumentFactory()

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id)},
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("role", [None, "reader"])
def test_api_documents_move_authenticated_document_no_permission(role):
    """
    Authenticated users should not be able to move documents with insufficient
    permissions on the origin document.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    target = factories.UserDocumentAccessFactory(user=user, role="owner").document

    if role:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id)},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_move_editor_of_root_document_cross_tree_refused():
    """
    An editor of a root document is not its owner: moving it across trees
    (here, into another tree) requires the owner role and must be refused.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "editor")])
    child = factories.DocumentFactory(parent=document)
    target = factories.DocumentFactory(users=[(user, "editor")])

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "last-child"},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the owner of a document can move it to another tree "
        "or to their docs."
    }

    document.refresh_from_db()
    assert document.is_root() is True
    assert list(document.get_children()) == [child]
    assert document.accesses.filter(user=user, role="editor").exists()


def test_api_documents_move_invalid_target_string():
    """Test for moving a document to an invalid target as a random string."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.UserDocumentAccessFactory(user=user, role="owner").document

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": "non-existent-id"},
    )

    assert response.status_code == 400
    assert response.json() == {"target_document_id": ["Must be a valid UUID."]}


def test_api_documents_move_invalid_target_uuid():
    """Test for moving a document to an invalid target that looks like a UUID."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.UserDocumentAccessFactory(user=user, role="owner").document

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(uuid4())},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "Target parent document does not exist."
    }


def test_api_documents_move_invalid_position():
    """Test moving a document to an invalid position."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.UserDocumentAccessFactory(user=user, role="owner").document
    target = factories.UserDocumentAccessFactory(user=user, role="owner").document

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={
            "target_document_id": str(target.id),
            "position": "invalid-position",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "position": ['"invalid-position" is not a valid choice.']
    }


@pytest.mark.parametrize("position", enums.MoveNodePositionChoices.values)
@pytest.mark.parametrize("target_parent_role", models.RoleChoices.values)
@pytest.mark.parametrize("target_role", models.RoleChoices.values)
def test_api_documents_move_authenticated_target_roles_mocked(
    target_role, target_parent_role, position
):
    """
    Only authenticated users with at least the editor role on the target document (or
    its parent depending on the position chosen), should be allowed to move documents.
    """

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # The mover owns the source document: the owner gate on scope changes
    # never fires in this test, which focuses on destination permissions.
    document = factories.DocumentFactory(users=[(user, "owner")])
    children = factories.DocumentFactory.create_batch(3, parent=document)

    target_parent = factories.DocumentFactory(users=[(user, target_parent_role)])
    sibling1, target, sibling2 = factories.DocumentFactory.create_batch(
        3, parent=target_parent
    )
    models.DocumentAccess.objects.create(document=target, user=user, role=target_role)
    target_children = factories.DocumentFactory.create_batch(2, parent=target)

    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/move/",
            data={"target_document_id": str(target.id), "position": position},
        )

    document.refresh_from_db()

    editor_roles = ["editor", "administrator", "owner"]

    if (
        position in ["first-child", "last-child"]
        and (target_role in editor_roles or target_parent_role in editor_roles)
    ) or (
        position in ["first-sibling", "last-sibling", "left", "right"]
        and target_parent_role in editor_roles
    ):
        assert response.status_code == 200
        assert response.json() == {"message": "Document moved successfully."}

        # The move should be tracked in PostHog
        mock_capture.assert_called_once_with(
            PosthogEventName.DOC_MOVED,
            user,
            {
                "position": position,
                "targeted_document_id": str(target.id),
                "scope_changed": True,
            },
            document=document,
        )

        match position:
            case "first-child":
                assert list(target.get_children()) == [document, *target_children]
            case "last-child":
                assert list(target.get_children()) == [*target_children, document]
            case "first-sibling":
                assert list(target.get_siblings()) == [
                    document,
                    sibling1,
                    target,
                    sibling2,
                ]
            case "last-sibling":
                assert list(target.get_siblings()) == [
                    sibling1,
                    target,
                    sibling2,
                    document,
                ]
            case "left":
                assert list(target.get_siblings()) == [
                    sibling1,
                    document,
                    target,
                    sibling2,
                ]
            case "right":
                assert list(target.get_siblings()) == [
                    sibling1,
                    target,
                    document,
                    sibling2,
                ]
            case _:
                raise ValueError(f"Invalid position: {position}")

        # Verify that the document's children have also been moved
        assert list(document.get_children()) == children
    else:
        assert response.status_code == 400
        assert (
            "You do not have permission to move documents"
            in response.json()["target_document_id"]
        )
        assert document.is_root() is True

        # No event should be tracked when the move is not permitted
        mock_capture.assert_not_called()


def test_api_documents_move_authenticated_no_owner_user_and_team():
    """
    A non-owner of the document cannot move it across trees: the move is
    refused with the owner-only 403 and the document is left untouched.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent_owner = factories.UserFactory()
    parent = factories.DocumentFactory(
        users=[(parent_owner, "owner")], teams=[("lasuite", "owner")]
    )
    # A document with no owner
    document = factories.DocumentFactory(parent=parent, users=[(user, "administrator")])
    child = factories.DocumentFactory(parent=document)
    target = factories.DocumentFactory()

    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/move/",
            data={"target_document_id": str(target.id), "position": "first-sibling"},
        )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the owner of a document can move it to another tree "
        "or to their docs."
    }

    # No event should be tracked when the move is not permitted
    mock_capture.assert_not_called()

    document.refresh_from_db()
    assert list(document.get_children()) == [child]
    assert document.accesses.count() == 1
    assert document.accesses.get(user=user, role="administrator")


def test_api_documents_move_authenticated_no_owner_same_user():
    """
    A mover who is an owner of the document through an inherited access on its
    previous root can move it across trees: the document's direct accesses are
    wiped so it inherits the destination's scope, and the mover is granted a
    personal owner access since no owner access remains.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(
        users=[(user, "owner")], teams=[("lasuite", "owner")]
    )
    # A document with no owner
    document = factories.DocumentFactory(parent=parent, users=[(user, "reader")])
    child = factories.DocumentFactory(parent=document)
    target = factories.DocumentFactory()

    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/move/",
            data={"target_document_id": str(target.id), "position": "first-sibling"},
        )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}
    assert list(target.get_siblings()) == [document, parent, target]

    # The move should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_MOVED,
        user,
        {
            "position": "first-sibling",
            "targeted_document_id": str(target.id),
            "scope_changed": True,
        },
        document=document,
    )

    document.refresh_from_db()
    assert list(document.get_children()) == [child]
    # The user's direct reader access and the lasuite team owner access were
    # wiped during the cross-tree move; the mover is granted a personal owner
    # access so the document is not left ownerless.
    assert document.accesses.count() == 1
    assert document.accesses.get(user__isnull=False, role="owner").user == user


def test_api_documents_move_authenticated_no_owner_same_team():
    """
    A mover who is owner of the document through a TEAM access inherited from
    its previous root can move it across trees: the document's direct accesses
    are wiped so it inherits the destination's scope, and the mover is granted
    a personal owner access since no owner access remains.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    with mock.patch(
        "core.models.User.teams", new_callable=mock.PropertyMock
    ) as mock_teams:
        mock_teams.return_value = ["lasuite"]

        parent = factories.DocumentFactory(teams=[("lasuite", "owner")])
        # A document with no owner but same team
        document = factories.DocumentFactory(
            parent=parent,
            users=[(user, "administrator")],
            teams=[("lasuite", "reader")],
        )
        child = factories.DocumentFactory(parent=document)
        target = factories.DocumentFactory()

        assert document.get_role(user) == models.RoleChoices.OWNER

        with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
            response = client.post(
                f"/api/v1.0/documents/{document.id!s}/move/",
                data={
                    "target_document_id": str(target.id),
                    "position": "first-sibling",
                },
            )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}
    assert list(target.get_siblings()) == [document, parent, target]

    # The move should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_MOVED,
        user,
        {
            "position": "first-sibling",
            "targeted_document_id": str(target.id),
            "scope_changed": True,
        },
        document=document,
    )

    document.refresh_from_db()
    assert list(document.get_children()) == [child]

    # The user's direct administrator access and the lasuite team access were
    # wiped during the cross-tree move; the mover is granted a personal owner
    # access so the document is not left ownerless.
    assert document.accesses.count() == 1
    assert document.accesses.get(user__isnull=False, role="owner").user == user


def test_api_documents_move_authenticated_deleted_document():
    """
    It should not be possible to move a deleted document or its descendants, even
    for an owner.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        users=[(user, "owner")], deleted_at=timezone.now()
    )
    child = factories.DocumentFactory(parent=document, users=[(user, "owner")])

    target = factories.DocumentFactory(users=[(user, "owner")])

    # Try moving the deleted document
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id)},
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    # Verify that the document has not moved
    document.refresh_from_db()
    assert document.is_root() is True

    # Try moving the child of the deleted document
    response = client.post(
        f"/api/v1.0/documents/{child.id!s}/move/",
        data={"target_document_id": str(target.id)},
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    # Verify that the child has not moved
    child.refresh_from_db()
    assert child.is_child_of(document) is True


@pytest.mark.parametrize(
    "position",
    enums.MoveNodePositionChoices.values,
)
def test_api_documents_move_authenticated_deleted_target_as_child(position):
    """
    It should not be possible to move a document as a child of a deleted target
    even for a owner.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])

    target = factories.DocumentFactory(
        users=[(user, "owner")], deleted_at=timezone.now()
    )
    child = factories.DocumentFactory(parent=target, users=[(user, "owner")])

    # Try moving the document to the deleted target
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": position},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "Target parent document does not exist."
    }

    # Verify that the document has not moved
    document.refresh_from_db()
    assert document.is_root() is True

    # Try moving the document to the child of the deleted target
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(child.id), "position": position},
    )
    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "Target parent document does not exist."
    }

    # Verify that the document has not moved
    document.refresh_from_db()
    assert document.is_root() is True


@pytest.mark.parametrize(
    "position",
    ["first-sibling", "last-sibling", "left", "right"],
)
def test_api_documents_move_authenticated_deleted_target_as_sibling(position):
    """
    It should not be possible to move a document as a sibling of a deleted target document
    if the user has no rights on its parent.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])

    target_parent = factories.DocumentFactory(
        users=[(user, "owner")], deleted_at=timezone.now()
    )
    target = factories.DocumentFactory(users=[(user, "owner")], parent=target_parent)

    # Try moving the document as a sibling of the target
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": position},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "Target parent document does not exist."
    }

    # Verify that the document has not moved
    document.refresh_from_db()
    assert document.is_root() is True


@pytest.mark.parametrize("position", enums.MoveNodePositionChoices.values)
def test_api_documents_move_to_descendant(position):
    """
    Moving a document to one of its descendants should return a validation error.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create a hierarchy: parent -> child -> grandchild
    parent = factories.DocumentFactory(users=[(user, "owner")])
    child = factories.DocumentFactory(parent=parent, users=[(user, "owner")])
    grandchild = factories.DocumentFactory(parent=child, users=[(user, "owner")])

    # Try moving parent to child (descendant)
    response = client.post(
        f"/api/v1.0/documents/{parent.id!s}/move/",
        data={"target_document_id": str(child.id), "position": position},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "Cannot move a document to its own descendant."
    }

    # Try moving parent to grandchild
    response = client.post(
        f"/api/v1.0/documents/{parent.id!s}/move/",
        data={"target_document_id": str(grandchild.id), "position": position},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "Cannot move a document to its own descendant."
    }

    # Try moving child to grandchild (still descendant)
    response = client.post(
        f"/api/v1.0/documents/{child.id!s}/move/",
        data={"target_document_id": str(grandchild.id), "position": position},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "Cannot move a document to its own descendant."
    }

    # Ensure documents have not moved
    parent.refresh_from_db()
    child.refresh_from_db()
    grandchild.refresh_from_db()
    assert parent.is_root() is True
    assert child.is_child_of(parent) is True
    assert grandchild.is_child_of(child) is True


@pytest.mark.parametrize(
    "position",
    [
        enums.MoveNodePositionChoices.FIRST_CHILD,
        enums.MoveNodePositionChoices.LAST_CHILD,
    ],
)
def test_api_documents_move_to_self(position):
    """
    Moving a document to itself should return a validation error.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])

    # Try moving document to itself
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(document.id), "position": position},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "Cannot move a document to its own descendant."
    }

    # Ensure document has not moved
    document.refresh_from_db()
    assert document.is_root() is True


def test_api_documents_move_root_deletes_accesses_and_invitations():
    """
    Moving a root document should automatically delete all its direct accesses and
    invitations so it inherits the target's permissions.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    document = factories.DocumentFactory(
        users=[(user, "owner"), (other_user, "editor")]
    )
    factories.InvitationFactory(document=document)
    factories.InvitationFactory(document=document)

    target = factories.DocumentFactory(users=[(user, "owner")])

    assert document.is_root()
    assert document.accesses.count() == 2
    assert document.invitations.count() == 2

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "first-child"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}

    document.refresh_from_db()
    assert document.is_child_of(target)
    # Direct accesses and invitations are wiped; the mover, who was an owner,
    # gets a fresh owner access so the document is not left ownerless.
    assert document.accesses.count() == 1
    assert document.accesses.get(user=user, role="owner")
    assert document.invitations.count() == 0


def test_api_documents_move_cross_tree_deletes_accesses_and_invitations():
    """
    Moving a non-root document to a different tree should delete its direct accesses
    and invitations because it is leaving its current permission scope.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    source_root = factories.DocumentFactory(users=[(user, "owner")])
    document = factories.DocumentFactory(
        parent=source_root, users=[(user, "owner"), (other_user, "editor")]
    )
    factories.InvitationFactory(document=document)

    target_root = factories.DocumentFactory(users=[(user, "owner")])
    target = factories.DocumentFactory(parent=target_root, users=[(user, "owner")])

    assert not document.is_root()
    assert document.get_root() != target.get_root()
    assert document.accesses.count() == 2
    assert document.invitations.count() == 1

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "first-child"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}

    document.refresh_from_db()
    assert document.is_child_of(target)
    # The other user's editor access is wiped; the mover, who was an owner,
    # gets a fresh owner access so the document is not left ownerless.
    assert document.accesses.count() == 1
    assert document.accesses.get(user=user, role="owner")
    assert document.invitations.count() == 0


def test_api_documents_move_same_tree_keeps_accesses_and_invitations():
    """
    Moving a non-root document within the same tree should preserve its direct
    accesses and invitations since it stays in the same permission scope.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    root = factories.DocumentFactory(users=[(user, "owner")])
    document = factories.DocumentFactory(
        parent=root, users=[(user, "owner"), (other_user, "editor")]
    )
    factories.InvitationFactory(document=document)
    target = factories.DocumentFactory(parent=root, users=[(user, "owner")])

    assert not document.is_root()
    assert document.get_root() == target.get_root()
    assert document.accesses.count() == 2
    assert document.invitations.count() == 1

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "first-child"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}

    document.refresh_from_db()
    assert document.is_child_of(target)
    assert document.accesses.count() == 2
    assert document.invitations.count() == 1


@pytest.mark.parametrize("position", ["first-sibling", "last-sibling", "left", "right"])
def test_api_documents_move_sub_document_to_root_deletes_accesses_and_invitations(
    position,
):
    """
    Moving a sub-document to root level (as a sibling of a root document) changes its
    permission scope. Its direct accesses and invitations must be deleted.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    parent = factories.DocumentFactory(users=[(user, "owner")])
    document = factories.DocumentFactory(
        parent=parent, users=[(user, "owner"), (other_user, "editor")]
    )
    factories.InvitationFactory(document=document)

    # target is a root document; moving as its sibling promotes document to root level
    target = factories.DocumentFactory(users=[(user, "owner")])

    assert not document.is_root()
    assert document.accesses.count() == 2
    assert document.invitations.count() == 1

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": position},
    )

    assert response.status_code == 200
    document.refresh_from_db()
    assert document.is_root()
    # Direct accesses and invitations are wiped; the mover is granted the owner
    # role so the document is not left ownerless.
    assert document.accesses.count() == 1
    assert document.accesses.get(user=user, role="owner")
    assert document.invitations.count() == 0


@pytest.mark.parametrize("position", ["first-sibling", "last-sibling", "left", "right"])
def test_api_documents_move_sub_document_as_sibling_of_its_own_root_deletes_accesses(
    position,
):
    """
    Moving a sub-document as a sibling of its current root promotes it to a
    new root. Even though before the move both share the same root, the document is
    leaving its permission scope and its direct accesses/invitations must be deleted.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    root = factories.DocumentFactory(users=[(user, "owner")])
    document = factories.DocumentFactory(
        parent=root, users=[(user, "owner"), (other_user, "editor")]
    )
    factories.InvitationFactory(document=document)

    assert not document.is_root()
    assert document.get_root() == root
    assert document.accesses.count() == 2
    assert document.invitations.count() == 1

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(root.id), "position": position},
    )

    assert response.status_code == 200
    document.refresh_from_db()
    assert document.is_root()
    # Original accesses wiped; the mover is granted the owner role so the
    # document is not left ownerless.
    assert document.accesses.count() == 1
    assert document.accesses.get(user=user, role="owner")
    assert document.invitations.count() == 0


@pytest.mark.parametrize("position", ["first-sibling", "last-sibling", "left", "right"])
def test_api_documents_move_root_as_sibling_of_root_preserves_owner(position):
    """
    Moving a root document as a sibling of another root keeps it its own scope:
    this is NOT a permission-scope change, so all its direct accesses and
    invitations are kept, and the move only requires the destination-agnostic
    editor gate on the source document (no owner needed).
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    document = factories.DocumentFactory(
        users=[(user, "editor"), (other_user, "editor")]
    )
    factories.InvitationFactory(document=document)

    target = factories.DocumentFactory(users=[(user, "owner")])

    assert document.is_root()
    assert target.is_root()

    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/move/",
            data={"target_document_id": str(target.id), "position": position},
        )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}
    document.refresh_from_db()
    assert document.is_root()
    # The document stays its own root/scope: everything is kept.
    assert document.accesses.count() == 2
    assert document.accesses.filter(user=user, role="editor").exists()
    assert document.accesses.filter(user=other_user, role="editor").exists()
    assert document.invitations.count() == 1

    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_MOVED,
        user,
        {
            "position": position,
            "targeted_document_id": str(target.id),
            "scope_changed": False,
        },
        document=document,
    )


def test_api_documents_move_scope_change_deletion_is_atomic(monkeypatch):
    """
    When accesses/invitations are to be deleted (root or cross-tree move), both
    deletions and the tree move are atomic: if the move fails, deletions roll back.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    document = factories.DocumentFactory(
        users=[(user, "owner"), (other_user, "editor")]
    )
    factories.InvitationFactory(document=document)
    target = factories.DocumentFactory(users=[(user, "owner")])

    assert document.is_root()
    assert document.accesses.count() == 2
    assert document.invitations.count() == 1

    # Force Document.move to fail *after* the deletion block has already run,
    # so we actually exercise the rollback path rather than bailing out earlier.
    def failing_move(self, *args, **kwargs):
        raise RuntimeError("Simulated move failure for atomicity test")

    monkeypatch.setattr(models.Document, "move", failing_move)

    with pytest.raises(RuntimeError, match="Simulated move failure"):
        client.post(
            f"/api/v1.0/documents/{document.id!s}/move/",
            data={"target_document_id": str(target.id), "position": "first-sibling"},
        )

    # Accesses and invitations must still exist due to transaction rollback
    document.refresh_from_db()
    assert document.accesses.count() == 2
    assert document.invitations.count() == 1


def test_api_documents_move_resets_connections_of_the_moved_document(
    mock_reset_service_connections, capture_service_resets
):
    """
    A moved document inherits the accesses of other ancestors: every
    connection of its subtree should be re-checked. The direct accesses it
    loses with its scope are each reported as well, and coalesced into that
    one reset of everybody.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    other_access = factories.UserDocumentAccessFactory(document=document)
    target = factories.DocumentFactory(users=[(user, "owner")])

    with capture_service_resets():
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/move/",
            data={
                "target_document_id": str(target.id),
                "position": enums.MoveNodePositionChoices.LAST_CHILD,
            },
        )

    assert response.status_code == 200
    assert not models.DocumentAccess.objects.filter(pk=other_access.pk).exists()
    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_api_documents_move_resets_connections_when_the_scope_is_kept(
    mock_reset_service_connections, capture_service_resets
):
    """
    Moving within the same tree touches no direct access, the ancestors change
    all the same: the subtree is re-checked.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory(users=[(user, "owner")])
    document, sibling = factories.DocumentFactory.create_batch(2, parent=root)

    with capture_service_resets():
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/move/",
            data={
                "target_document_id": str(sibling.id),
                "position": enums.MoveNodePositionChoices.LAST_CHILD,
            },
        )

    assert response.status_code == 200
    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_api_documents_move_resets_nothing_when_refused(
    mock_reset_service_connections, capture_service_resets
):
    """A refused move changes nothing, and reports nothing."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    child = factories.DocumentFactory(parent=document)

    with capture_service_resets():
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/move/",
            data={
                "target_document_id": str(child.id),
                "position": enums.MoveNodePositionChoices.LAST_CHILD,
            },
        )

    assert response.status_code == 400
    mock_reset_service_connections.assert_not_called()


def test_api_documents_move_editor_same_tree_allowed_as_child():
    """
    An editor of a sub-document can move it within the same tree as a child of
    another document of that tree: no scope change, accesses are kept.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory(users=[(user, "editor")])
    document = factories.DocumentFactory(parent=root, users=[(user, "editor")])
    other_user = factories.UserFactory()
    other_access = factories.UserDocumentAccessFactory(
        document=document, user=other_user, role="editor"
    )
    target = factories.DocumentFactory(parent=root, users=[(user, "editor")])

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "last-child"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}

    document.refresh_from_db()
    assert document.is_child_of(target)
    # Same tree: no scope change, accesses are kept.
    assert document.accesses.filter(pk=other_access.pk).exists()


def test_api_documents_move_editor_same_tree_allowed_as_sibling():
    """
    An editor of a sub-document can move it within the same tree as a sibling
    of another sub-document.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory(users=[(user, "owner")])
    document = factories.DocumentFactory(parent=root, users=[(user, "editor")])
    sibling = factories.DocumentFactory(parent=root)
    other_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=other_user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(sibling.id), "position": "left"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}

    document.refresh_from_db()
    assert list(sibling.get_siblings()) == [document, sibling]
    assert document.accesses.filter(user=other_user).exists()


def test_api_documents_move_editor_cross_tree_refused():
    """
    An editor (not owner) of a sub-document cannot move it to another tree:
    403 and the document is left untouched.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=root, users=[(user, "editor")])
    child = factories.DocumentFactory(parent=document)
    target_root = factories.DocumentFactory()
    target = factories.DocumentFactory(parent=target_root, users=[(user, "editor")])

    assert document.get_role(user) == models.RoleChoices.EDITOR

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "last-child"},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the owner of a document can move it to another tree "
        "or to their docs."
    }

    document.refresh_from_db()
    assert document.get_root() == root
    assert list(document.get_children()) == [child]


def test_api_documents_move_admin_cross_tree_refused():
    """
    An administrator is not enough to move a document across trees: only the
    owner may change its permission scope.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=root, users=[(user, "administrator")])
    target_root = factories.DocumentFactory()
    target = factories.DocumentFactory(parent=target_root, users=[(user, "owner")])

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "last-child"},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the owner of a document can move it to another tree "
        "or to their docs."
    }

    document.refresh_from_db()
    assert document.get_root() == root


@pytest.mark.parametrize("position", ["first-sibling", "last-sibling", "left", "right"])
def test_api_documents_move_promote_to_root_grants_mover_owner_access(position):
    """
    Promoting a sub-document to root level requires being its owner; after the
    promotion the mover is granted a personal owner access since the previous
    accesses were wiped and no owner access remains.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory(users=[(user, "owner")])
    document = factories.DocumentFactory(parent=root, users=[(user, "owner")])

    target = factories.DocumentFactory(users=[(user, "owner")])

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": position},
    )

    assert response.status_code == 200
    document.refresh_from_db()
    assert document.is_root()
    assert document.accesses.count() == 1
    assert document.accesses.get(user=user, role="owner")


@pytest.mark.parametrize("position", ["first-sibling", "last-sibling", "left", "right"])
def test_api_documents_move_promote_to_root_editor_refused(position):
    """
    Promoting a sub-document to root level changes its permission scope and is
    therefore owner-only: an editor is refused with a 403.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=root, users=[(user, "editor")])

    target = factories.DocumentFactory()

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": position},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the owner of a document can move it to another tree "
        "or to their docs."
    }

    document.refresh_from_db()
    assert not document.is_root()
    assert document.get_root() == root


@pytest.mark.parametrize("position", ["first-sibling", "last-sibling", "left", "right"])
def test_api_documents_move_promote_to_root_same_tree_requires_owner(position):
    """
    Promoting a sub-document as a sibling of its OWN root is a scope change
    (it becomes a root of its own) and requires the owner role, even though
    the move stays within the same tree.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    root = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=root, users=[(user, "editor")])

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(root.id), "position": position},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the owner of a document can move it to another tree "
        "or to their docs."
    }

    document.refresh_from_db()
    assert not document.is_root()


def test_api_documents_move_link_role_editor_cannot_move():
    """
    Link roles never grant move: an anonymous user on a document with an
    editor link gets no `move`/`move_into` ability and the move endpoint
    refuses them.
    """
    document = factories.DocumentFactory(link_reach="public", link_role="editor")
    target = factories.DocumentFactory(link_reach="public", link_role="editor")

    # Abilities: no access role, only a link role
    assert document.get_abilities(AnonymousUser())["move"] is False
    assert target.get_abilities(AnonymousUser())["move_into"] is False

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "last-child"},
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_documents_move_link_role_editor_authenticated_cannot_move():
    """
    Same for an authenticated user whose only rights come from the link role:
    they can update the document but never move it.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="authenticated", link_role="editor")
    target = factories.DocumentFactory(link_reach="authenticated", link_role="editor")

    # The link grants update, but never move/move_into
    abilities = document.get_abilities(user)
    assert abilities["update"] is True
    assert abilities["move"] is False
    assert target.get_abilities(user)["move_into"] is False

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "last-child"},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_move_commenter_cannot_move():
    """A commenter of a document has no move ability and is refused by the API."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "commenter")])
    target = factories.DocumentFactory(users=[(user, "owner")])

    assert document.get_abilities(user)["move"] is False

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "last-child"},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_move_destination_commenter_refused():
    """
    Moving a document as a child requires the move_into ability on the target:
    a commenter of the target document is refused with a 400.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    target = factories.DocumentFactory(users=[(user, "commenter")])

    assert target.get_abilities(user)["move_into"] is False

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "last-child"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "You do not have permission to move documents "
        "as a child to this target document."
    }

    document.refresh_from_db()
    assert document.is_root() is True


def test_api_documents_move_destination_sibling_commenter_refused():
    """
    Moving a document as a sibling requires the move_into ability on the
    target's parent: refused with a 400 when missing.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])
    target_parent = factories.DocumentFactory(users=[(user, "commenter")])
    target = factories.DocumentFactory(parent=target_parent)

    assert target.get_parent().get_abilities(user)["move_into"] is False

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "left"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "You do not have permission to move documents "
        "as a sibling of this target document."
    }

    document.refresh_from_db()
    assert document.is_root() is True


def test_api_documents_move_team_owner_promotion_grants_personal_owner():
    """
    A user who is owner of the moved document through a TEAM access passes the
    owner gate; after the scope change the whole team loses its access on the
    moved document (direct accesses are wiped) and the mover is granted a
    PERSONAL owner access so the document is not left ownerless.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    with mock.patch(
        "core.models.User.teams", new_callable=mock.PropertyMock
    ) as mock_teams:
        mock_teams.return_value = ["lasuite"]

        document = factories.DocumentFactory(teams=[("lasuite", "owner")])
        other_user = factories.UserFactory()
        other_access = factories.UserDocumentAccessFactory(
            document=document, user=other_user, role="editor"
        )
        target = factories.DocumentFactory(users=[(user, "editor")])

        assert document.get_role(user) == models.RoleChoices.OWNER

        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/move/",
            data={"target_document_id": str(target.id), "position": "last-child"},
        )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}

    document.refresh_from_db()
    assert document.is_child_of(target)
    # The team owner access and the other user's editor access were wiped; the
    # mover got a personal owner access instead.
    assert not models.DocumentAccess.objects.filter(pk=other_access.pk).exists()
    assert document.accesses.count() == 1
    owner_access = document.accesses.get(role="owner")
    assert owner_access.user == user
    assert owner_access.team == ""


def test_api_documents_move_root_to_child_of_non_root_target_requires_owner():
    """
    A root document dropped INTO a non-root target gains a parent: this is a
    scope change and requires the owner role. Direct accesses are wiped and
    the mover becomes owner.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    document = factories.DocumentFactory(
        users=[(user, "editor"), (other_user, "editor")]
    )
    target_root = factories.DocumentFactory(users=[(user, "owner")])
    target = factories.DocumentFactory(parent=target_root, users=[(user, "editor")])

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "last-child"},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only the owner of a document can move it to another tree "
        "or to their docs."
    }

    document.refresh_from_db()
    assert document.is_root() is True
    assert document.accesses.count() == 2
