"""
Test moving documents within the document tree via an detail action API endpoint.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_api_documents_detach_anonymous_user():
    """Anonymous users should not be able to detach documents."""
    target = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=target)

    response = APIClient().post(f"/api/v1.0/documents/{document.id!s}/detach/")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_documents_move_document_is_root():
    """
    Detaching a root document should not be allowed
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")])

    response = client.post(f"/api/v1.0/documents/{document.id!s}/detach/")

    assert response.status_code == 400
    assert response.json() == {"message": "You cannot detach a root document"}


@pytest.mark.parametrize("role", [None, "reader", "commenter", "editor"])
def test_api_documents_detach_authenticated_document_no_permission(role):
    """
    Authenticated users should not be able to detach documents with insufficient
    permissions on the root document.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    target = factories.DocumentFactory()
    if role:
        factories.UserDocumentAccessFactory(document=target, user=user, role=role)
    document = factories.DocumentFactory(parent=target)

    response = client.post(f"/api/v1.0/documents/{document.id!s}/detach/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize("user_role", models.RoleChoices.values)
@pytest.mark.parametrize("is_creator", [True, False])
def test_api_documents_move_authenticated_detach(
    is_creator,
    user_role,
):
    """
    Authenticated users with permissions should be allowed to detach documents
    """

    power_roles = ["administrator", "owner"]

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    target_owner = factories.UserFactory()
    target = factories.DocumentFactory(
        users=[(target_owner, "owner"), (user, user_role)]
    )

    document_args = {"parent": target}
    if is_creator:
        document_args["creator"] = user

    document = factories.DocumentFactory(**document_args)
    child = factories.DocumentFactory(parent=document)

    response = client.post(f"/api/v1.0/documents/{document.id!s}/detach/")
    document.refresh_from_db()

    if user_role in power_roles or (
        (
            user_role == models.RoleChoices.EDITOR
            or target.get_role(user) == models.RoleChoices.EDITOR
        )
        and is_creator
    ):
        assert response.status_code == 200

        assert target in list(target.get_siblings())
        assert document in list(target.get_siblings())
        assert list(document.get_children()) == [child]
    else:
        assert response.status_code == 403


def test_api_documents_move_authenticated_no_owner_user_and_team():
    """
    Detaching a document with no owner to the root of the tree should automatically declare
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

    response = client.post(f"/api/v1.0/documents/{document.id!s}/detach/")

    assert response.status_code == 200
    assert response.json() == {"message": "Document detached successfully."}
    assert document in target.get_siblings()
    assert parent in target.get_siblings()
    assert target in target.get_siblings()

    document.refresh_from_db()
    assert list(document.get_children()) == [child]
    assert document.accesses.count() == 3
    assert document.accesses.get(user__isnull=False, role="owner").user == parent_owner
    assert document.accesses.get(user__isnull=True, role="owner").team == "lasuite"
    assert document.accesses.get(role="administrator").user == user


def test_api_documents_move_authenticated_no_owner_same_user():
    """
    Detaching a document should not fail if the user moving a document with no owner was
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

    response = client.post(f"/api/v1.0/documents/{document.id!s}/detach/")

    assert response.status_code == 200
    assert response.json() == {"message": "Document detached successfully."}
    assert document in target.get_siblings()
    assert parent in target.get_siblings()
    assert target in target.get_siblings()

    document.refresh_from_db()
    assert list(document.get_children()) == [child]
    assert document.accesses.count() == 2
    assert document.accesses.get(user__isnull=False, role="owner").user == user
    assert document.accesses.get(user__isnull=True, role="owner").team == "lasuite"


def test_api_documents_move_authenticated_no_owner_same_team():
    """
    Detaching a document should not fail if the team that is owner of the document root was
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

    response = client.post(f"/api/v1.0/documents/{document.id!s}/detach/")

    assert response.status_code == 200
    assert response.json() == {"message": "Document detached successfully."}
    assert document in target.get_siblings()
    assert parent in target.get_siblings()
    assert target in target.get_siblings()

    document.refresh_from_db()
    assert list(document.get_children()) == [child]
    assert document.accesses.count() == 2
    assert document.accesses.get(user__isnull=False, role="administrator").user == user
    assert document.accesses.get(user__isnull=True, role="owner").team == "lasuite"
