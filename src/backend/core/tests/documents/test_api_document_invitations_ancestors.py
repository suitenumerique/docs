"""
Test the rights on the invitations of a sub-page, which count the roles of the
user on the ancestors of the document, as for its accesses.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db

ROLES = ["reader", "editor", "administrator", "owner"]


def create_sub_page(user, role, via, mock_user_teams):
    """Create a sub-page on which `user` only has `role` through its parent."""
    parent = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=parent, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(document=parent, team="lasuite", role=role)
    return factories.DocumentFactory(parent=parent)


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ROLES)
def test_api_document_invitations_ancestors_list(role, via, mock_user_teams):
    """Owners and administrators of an ancestor see the invitations of a sub-page."""
    user = factories.UserFactory()
    document = create_sub_page(user, role, via, mock_user_teams)
    factories.InvitationFactory.create_batch(2, document=document)

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/invitations/")

    assert response.status_code == 200
    if role in ["administrator", "owner"]:
        assert response.json()["count"] == 2
    else:
        assert response.json()["count"] == 0


@pytest.mark.parametrize("invitation_role", ["editor", "owner"])
@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ROLES)
def test_api_document_invitations_ancestors_create(
    role, via, invitation_role, mock_user_teams
):
    """
    Owners and administrators of an ancestor invite users on a sub-page, and only
    owners invite them as owners.
    """
    user = factories.UserFactory()
    document = create_sub_page(user, role, via, mock_user_teams)

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        {"email": "guest@example.com", "role": invitation_role},
        format="json",
    )

    if role not in ["administrator", "owner"]:
        assert response.status_code == 403
    elif invitation_role == "owner" and role != "owner":
        assert response.status_code == 400
        assert response.json() == {
            "role": ["Only owners of a document can invite other users as owners."]
        }
    else:
        assert response.status_code == 201
        assert models.Invitation.objects.get(document=document).role == invitation_role
        return
    assert not models.Invitation.objects.exists()


@pytest.mark.parametrize("invitation_role", ["editor", "owner"])
@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ROLES)
def test_api_document_invitations_ancestors_update(
    role, via, invitation_role, mock_user_teams
):
    """
    Owners and administrators of an ancestor update the invitations of a sub-page,
    except owner invitations, which only owners may update.
    """
    user = factories.UserFactory()
    document = create_sub_page(user, role, via, mock_user_teams)
    invitation = factories.InvitationFactory(document=document, role=invitation_role)

    client = APIClient()
    client.force_login(user)

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/",
        {"role": "reader"},
        format="json",
    )

    invitation.refresh_from_db()
    if role == "owner" or (role == "administrator" and invitation_role != "owner"):
        assert response.status_code == 200
        assert invitation.role == "reader"
    else:
        assert response.status_code == 403
        assert invitation.role == invitation_role


@pytest.mark.parametrize("invitation_role", ["editor", "owner"])
@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ROLES)
def test_api_document_invitations_ancestors_delete(
    role, via, invitation_role, mock_user_teams
):
    """
    Owners and administrators of an ancestor cancel the invitations of a sub-page,
    except owner invitations, which only owners may cancel.
    """
    user = factories.UserFactory()
    document = create_sub_page(user, role, via, mock_user_teams)
    invitation = factories.InvitationFactory(document=document, role=invitation_role)

    client = APIClient()
    client.force_login(user)

    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/",
    )

    if role == "owner" or (role == "administrator" and invitation_role != "owner"):
        assert response.status_code == 204
        assert not models.Invitation.objects.exists()
    else:
        assert response.status_code == 403
        assert models.Invitation.objects.filter(id=invitation.id).exists()


def test_api_document_invitations_ancestors_owner_direct_administrator():
    """
    An owner of the parent who is also a direct administrator of the sub-page
    manages the owner invitations of the sub-page, as they manage its owner
    accesses.
    """
    alice = factories.UserFactory()
    bob = factories.UserFactory()
    parent = factories.DocumentFactory(users=[(alice, "owner")])
    document = factories.DocumentFactory(
        parent=parent, users=[(alice, "administrator"), (bob, "owner")]
    )
    invitation = factories.InvitationFactory(
        document=document, role="owner", issuer=bob
    )

    client = APIClient()
    client.force_login(alice)
    url = f"/api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/"

    response = client.get(url)
    assert response.status_code == 200
    assert response.json()["abilities"] == {
        "destroy": True,
        "retrieve": True,
        "partial_update": True,
        "update": True,
        "set_role_to": models.RoleChoices.values,
    }

    response = client.patch(url, {"role": "editor"}, format="json")
    assert response.status_code == 200
    invitation.refresh_from_db()
    assert invitation.role == "editor"

    response = client.patch(url, {"role": "owner"}, format="json")
    assert response.status_code == 200

    response = client.delete(url)
    assert response.status_code == 204
    assert not models.Invitation.objects.exists()
