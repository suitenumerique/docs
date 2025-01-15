"""
Test moving documents within the document tree via an detail action API endpoint.
"""

from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from core import factories

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


@pytest.mark.parametrize("role", [None, "reader", "editor"])
def test_api_documents_move_authenticated_target_no_permission(role):
    """
    Authenticated users should not be able to move documents with insufficient
    permissions on the origin document.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.UserDocumentAccessFactory(user=user, role="owner").document
    target = factories.DocumentFactory()

    if role:
        factories.UserDocumentAccessFactory(document=target, user=user, role=role)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id)},
    )

    assert response.status_code == 400
    assert response.json() == {
        "target_document_id": "You do not have permission to move documents to this target."
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


@pytest.mark.parametrize(
    "position",
    ["first-child", "last-child", "first-sibling", "last-sibling", "left", "right"],
)
@pytest.mark.parametrize("target_role", ["administrator", "owner"])
@pytest.mark.parametrize("role", ["administrator", "owner"])
def test_api_documents_move_authenticated_success(role, target_role, position):
    """
    Authenticated users with sufficient permissions should be able to move documents
    as a child of the target document.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.UserDocumentAccessFactory(user=user, role=role).document
    children = factories.DocumentFactory.create_batch(3, parent=document)

    target_parent = factories.UserDocumentAccessFactory(
        user=user, role=target_role
    ).document
    sibling1, target, sibling2 = factories.DocumentFactory.create_batch(
        3, parent=target_parent
    )
    target_children = factories.DocumentFactory.create_batch(3, parent=target)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/move/",
        data={"target_document_id": str(target.id), "position": position},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Document moved successfully."}

    # Verify that the document has moved as expected in the tree
    document.refresh_from_db()
    target.refresh_from_db()

    match position:
        case "first-child":
            assert list(target.get_children()) == [document, *target_children]
        case "last-child":
            assert list(target.get_children()) == [*target_children, document]
        case "first-sibling":
            assert list(target.get_siblings()) == [document, sibling1, target, sibling2]
        case "last-sibling":
            assert list(target.get_siblings()) == [sibling1, target, sibling2, document]
        case "left":
            assert list(target.get_siblings()) == [sibling1, document, target, sibling2]
        case "right":
            assert list(target.get_siblings()) == [sibling1, target, document, sibling2]
        case _:
            raise ValueError(f"Invalid position: {position}")

    # Verify that the document's children have also been moved
    assert list(document.get_children()) == children
