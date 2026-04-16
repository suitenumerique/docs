"""
Test moving documents within the document tree via an detail action API endpoint.
"""

import random
from uuid import uuid4

from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import enums, factories, models

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


@pytest.mark.parametrize("role", [None, "reader", "editor"])
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
    Only authenticated users with sufficient permissions on the target document (or its
    parent depending on the position chosen), should be allowed to move documents.
    """

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    power_roles = ["administrator", "owner"]

    document = factories.DocumentFactory(users=[(user, random.choice(power_roles))])
    children = factories.DocumentFactory.create_batch(3, parent=document)

    target_parent = factories.DocumentFactory(users=[(user, target_parent_role)])
    sibling1, target, sibling2 = factories.DocumentFactory.create_batch(
        3, parent=target_parent
    )
    models.DocumentAccess.objects.create(document=target, user=user, role=target_role)
    target_children = factories.DocumentFactory.create_batch(2, parent=target)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": position},
    )

    document.refresh_from_db()

    if (
        position in ["first-child", "last-child"]
        and (target_role in power_roles or target_parent_role in power_roles)
    ) or (
        position in ["first-sibling", "last-sibling", "left", "right"]
        and target_parent_role in power_roles
    ):
        assert response.status_code == 200
        assert response.json() == {"message": "Document moved successfully."}

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


def test_api_documents_move_authenticated_no_owner_user_and_team():
    """
    Moving a document with no owner to the root of the tree should automatically declare
    the owner of the previous root of the document as owner of the document itself.
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

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "first-sibling"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}
    assert list(target.get_siblings()) == [document, parent, target]

    document.refresh_from_db()
    assert list(document.get_children()) == [child]

    assert document.accesses.count() == 2
    assert document.accesses.get(user__isnull=False, role="owner").user == parent_owner
    assert document.accesses.get(user__isnull=True, role="owner").team == "lasuite"


def test_api_documents_move_authenticated_no_owner_same_user():
    """
    Moving a document should not fail if the user moving a document with no owner was
    at the same time owner of the previous root and has a role on the document being moved.
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

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "first-sibling"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}
    assert list(target.get_siblings()) == [document, parent, target]

    document.refresh_from_db()
    assert list(document.get_children()) == [child]
    assert document.accesses.count() == 2
    assert document.accesses.get(user__isnull=False, role="owner").user == user
    assert document.accesses.get(user__isnull=True, role="owner").team == "lasuite"


def test_api_documents_move_authenticated_no_owner_same_team():
    """
    Moving a document should not fail if the team that is owner of the document root was
    already declared on the document with a different role.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(teams=[("lasuite", "owner")])
    # A document with no owner but same team
    document = factories.DocumentFactory(
        parent=parent, users=[(user, "administrator")], teams=[("lasuite", "reader")]
    )
    child = factories.DocumentFactory(parent=document)
    target = factories.DocumentFactory()

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": "first-sibling"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}
    assert list(target.get_siblings()) == [document, parent, target]

    document.refresh_from_db()
    assert list(document.get_children()) == [child]

    # The user's direct administrator access was wiped during the cross-tree move;
    # only the "lasuite" team remains, re-added as owner from the previous root.
    assert document.accesses.count() == 1
    assert document.accesses.get(user__isnull=True, role="owner").team == "lasuite"


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
    assert document.accesses.count() == 0
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
    assert document.accesses.count() == 0
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
    # Direct accesses and invitations are wiped; the backend then ensures at least one
    # owner exists by inheriting the owner(s) from the previous root.
    assert document.accesses.count() == 1
    assert document.accesses.filter(role="owner").exists()
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
    # Original accesses wiped; owner re-inherited from previous root ensures non-orphaned.
    assert document.accesses.count() == 1
    assert document.accesses.filter(role="owner").exists()
    assert document.invitations.count() == 0


@pytest.mark.parametrize("position", ["first-sibling", "last-sibling", "left", "right"])
def test_api_documents_move_root_as_sibling_of_root_preserves_owner(position):
    """
    Moving a root document as sibling of another root, the owners
    collected from the previous root (which is the document itself) must survive the
    pre-move access deletion, so the document keeps at least one owner afterwards.
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
    assert target.is_root()

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": position},
    )

    assert response.status_code == 200
    document.refresh_from_db()
    assert document.is_root()
    # The original editor access and invitation are wiped; the previous root owner
    # is re-added so the document still has at least one owner.
    assert document.accesses.count() == 1
    assert document.accesses.get(role="owner").user == user
    assert document.invitations.count() == 0


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
