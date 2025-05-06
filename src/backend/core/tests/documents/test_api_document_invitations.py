"""
Unit tests for the Invitation model
"""

# pylint: disable=too-many-positional-arguments, too-many-arguments
import random
from datetime import timedelta
from unittest import mock
from uuid import uuid4

from django.core import mail
from django.test import override_settings
from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import serializers
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


# List


def test_api_document_invitations_list_anonymous_user():
    """Anonymous users should not be able to list invitations."""
    invitation = factories.InvitationFactory()
    response = APIClient().get(
        f"/api/v1.0/documents/{invitation.document.id!s}/invitations/"
    )
    assert response.status_code == 401


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ["owner", "administrator"])
def test_api_document_invitations_list_authenticated_privileged(
    role, via, mock_user_teams, django_assert_num_queries
):
    """
    Authenticated users should be able to list invitations for documents to which they are
    related with administrator or owner privilege, including invitations issued by other users.
    """
    user = factories.UserFactory()
    other_user = factories.UserFactory()
    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    invitation = factories.InvitationFactory(document=document, issuer=user)
    other_invitations = factories.InvitationFactory.create_batch(
        2, document=document, issuer=other_user
    )

    # invitations from other documents should not be listed
    other_document = factories.DocumentFactory()
    factories.InvitationFactory.create_batch(2, document=other_document)

    client = APIClient()
    client.force_login(user)
    with django_assert_num_queries(3):
        response = client.get(
            f"/api/v1.0/documents/{document.id!s}/invitations/",
        )
    assert response.status_code == 200
    assert response.json()["count"] == 3
    assert sorted(response.json()["results"], key=lambda x: x["created_at"]) == sorted(
        [
            {
                "id": str(i.id),
                "created_at": i.created_at.isoformat().replace("+00:00", "Z"),
                "email": str(i.email),
                "document": str(document.id),
                "role": i.role,
                "issuer": str(i.issuer.id),
                "is_expired": False,
                "abilities": {
                    "destroy": role in ["administrator", "owner"],
                    "update": role in ["administrator", "owner"],
                    "partial_update": role in ["administrator", "owner"],
                    "retrieve": True,
                },
            }
            for i in [invitation, *other_invitations]
        ],
        key=lambda x: x["created_at"],
    )


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ["reader", "editor"])
def test_api_document_invitations_list_authenticated_unprivileged(
    role, via, mock_user_teams, django_assert_num_queries
):
    """
    Authenticated users should not be able to list invitations for documents to which they are
    related with reader or editor role, including invitations issued by other users.
    """
    user = factories.UserFactory()
    other_user = factories.UserFactory()
    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    factories.InvitationFactory(document=document, issuer=user)
    factories.InvitationFactory.create_batch(2, document=document, issuer=other_user)

    # invitations from other documents should not be listed
    other_document = factories.DocumentFactory()
    factories.InvitationFactory.create_batch(2, document=other_document)

    client = APIClient()
    client.force_login(user)
    with django_assert_num_queries(2):
        response = client.get(
            f"/api/v1.0/documents/{document.id!s}/invitations/",
        )
    assert response.status_code == 200
    assert response.json()["count"] == 0


def test_api_document_invitations_list_expired_invitations_still_listed():
    """
    Expired invitations are still listed.
    """
    user = factories.UserFactory()
    other_user = factories.UserFactory()

    document = factories.DocumentFactory(
        users=[(user, "administrator"), (other_user, "owner")]
    )

    expired_invitation = factories.InvitationFactory(
        document=document,
        role="reader",
        issuer=user,
    )

    client = APIClient()
    client.force_login(user)

    # mock timezone.now to accelerate validation expiration
    too_late = timezone.now() + timedelta(seconds=604800)  # 7 days
    with mock.patch("django.utils.timezone.now", return_value=too_late):
        assert expired_invitation.is_expired is True

        response = client.get(
            f"/api/v1.0/documents/{document.id!s}/invitations/",
        )

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert sorted(response.json()["results"], key=lambda x: x["created_at"]) == sorted(
        [
            {
                "id": str(expired_invitation.id),
                "created_at": expired_invitation.created_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "email": str(expired_invitation.email),
                "document": str(document.id),
                "role": expired_invitation.role,
                "issuer": str(expired_invitation.issuer.id),
                "is_expired": True,
                "abilities": {
                    "destroy": True,
                    "update": True,
                    "partial_update": True,
                    "retrieve": True,
                },
            },
        ],
        key=lambda x: x["created_at"],
    )


# Retrieve


def test_api_document_invitations_retrieve_anonymous_user():
    """
    Anonymous users should not be able to retrieve invitations.
    """

    invitation = factories.InvitationFactory()
    response = APIClient().get(
        f"/api/v1.0/documents/{invitation.document.id!s}/invitations/{invitation.id!s}/",
    )

    assert response.status_code == 401


def test_api_document_invitations_retrieve_unrelated_user():
    """
    Authenticated unrelated users should not be able to retrieve invitations.
    """
    user = factories.UserFactory()
    invitation = factories.InvitationFactory()

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{invitation.document.id!s}/invitations/{invitation.id!s}/",
    )

    assert response.status_code == 403


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ["administrator", "owner"])
def test_api_document_invitations_retrieve_document_privileged(
    role, via, mock_user_teams
):
    """
    Authenticated users related to the document should be able to retrieve invitations
    provided they are administrators or owners of the document.
    """
    user = factories.UserFactory()
    invitation = factories.InvitationFactory()

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=invitation.document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=invitation.document, team="lasuite", role=role
        )

    client = APIClient()
    client.force_login(user)

    response = client.get(
        f"/api/v1.0/documents/{invitation.document.id!s}/invitations/{invitation.id!s}/",
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(invitation.id),
        "created_at": invitation.created_at.isoformat().replace("+00:00", "Z"),
        "email": invitation.email,
        "document": str(invitation.document.id),
        "role": str(invitation.role),
        "issuer": str(invitation.issuer.id),
        "is_expired": False,
        "abilities": {
            "destroy": True,
            "update": True,
            "partial_update": True,
            "retrieve": True,
        },
    }


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ["reader", "editor"])
def test_api_document_invitations_retrieve_document_unprivileged(
    role, via, mock_user_teams
):
    """
    Authenticated users related to the document should not be able to retrieve invitations
    if they are simply reader or editor of the document.
    """
    user = factories.UserFactory()
    invitation = factories.InvitationFactory()

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=invitation.document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=invitation.document, team="lasuite", role=role
        )

    client = APIClient()
    client.force_login(user)

    response = client.get(
        f"/api/v1.0/documents/{invitation.document.id!s}/invitations/{invitation.id!s}/",
    )

    assert response.status_code == 403
    assert response.content


# Create


def test_api_document_invitations_create_anonymous():
    """Anonymous users should not be able to create invitations."""
    document = factories.DocumentFactory()
    invitation_values = {
        "email": "guest@example.com",
        "role": random.choice(models.RoleChoices.values),
    }

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        invitation_values,
        format="json",
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_document_invitations_create_authenticated_outsider():
    """Users outside of document should not be permitted to invite to document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    invitation_values = {
        "email": "guest@example.com",
        "role": random.choice(models.RoleChoices.values),
    }

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        invitation_values,
        format="json",
    )

    assert response.status_code == 403


@override_settings(EMAIL_BRAND_NAME="My brand name", EMAIL_LOGO_IMG="my-img.jpg")
@pytest.mark.parametrize("depth", [1, 2, 3])
@pytest.mark.parametrize(
    "inviting,invited,response_code",
    (
        ["reader", "reader", 403],
        ["reader", "editor", 403],
        ["reader", "administrator", 403],
        ["reader", "owner", 403],
        ["editor", "reader", 403],
        ["editor", "editor", 403],
        ["editor", "administrator", 403],
        ["editor", "owner", 403],
        ["administrator", "reader", 201],
        ["administrator", "editor", 201],
        ["administrator", "administrator", 201],
        ["administrator", "owner", 400],
        ["owner", "reader", 201],
        ["owner", "editor", 201],
        ["owner", "administrator", 201],
        ["owner", "owner", 201],
    ),
)
@pytest.mark.parametrize("via", VIA)
def test_api_document_invitations_create_privileged_members(  # noqa: PLR0913
    via, inviting, invited, response_code, depth, mock_user_teams
):
    """
    Only owners and administrators should be able to invite new users.
    Only owners can invite owners.
    """
    user = factories.UserFactory(language="en-us")

    documents = []
    for i in range(depth):
        parent = documents[i - 1] if i > 0 else None
        documents.append(factories.DocumentFactory(parent=parent))

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=documents[0], user=user, role=inviting
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=documents[0], team="lasuite", role=inviting
        )
    document = documents[-1]

    invitation_values = {
        "email": "guest@example.com",
        "role": invited,
    }

    assert len(mail.outbox) == 0

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        invitation_values,
        format="json",
    )

    assert response.status_code == response_code

    if response_code == 201:
        assert models.Invitation.objects.count() == 1

        assert len(mail.outbox) == 1
        email = mail.outbox[0]
        assert email.to == ["guest@example.com"]
        email_content = " ".join(email.body.split())
        assert f"{user.full_name} shared a document with you!" in email_content
        assert (
            f"{user.full_name} ({user.email}) invited you with the role &quot;{invited}&quot; "
            f"on the following document: {document.title}"
        ) in email_content
        assert "My brand name" in email_content
        assert "my-img.jpg" in email_content
    else:
        assert models.Invitation.objects.exists() is False

    if response_code == 400:
        assert response.json() == {
            "role": [
                "Only owners of a document can invite other users as owners.",
            ],
        }


def test_api_document_invitations_create_unknown_document():
    """Trying to create an invitation for an unknown document should return a 404."""
    user = factories.UserFactory(language="en-us")

    invitation_values = {
        "email": "guest@example.com",
        "role": "reader",
    }

    assert len(mail.outbox) == 0

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{uuid4()!s}/invitations/",
        invitation_values,
        format="json",
    )

    assert response.status_code == 404
    assert models.Invitation.objects.exists() is False
    assert response.json() == {"detail": "Not found."}


def test_api_document_invitations_create_email_from_senders_language():
    """
    When inviting on a document a user who does not exist yet in our database,
    the invitation email should be sent in the language of the sending user.
    """
    user = factories.UserFactory(language="fr-fr")
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    invitation_values = {
        "email": "guest@example.com",
        "role": "reader",
    }

    assert len(mail.outbox) == 0

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        invitation_values,
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["email"] == "guest@example.com"
    assert models.Invitation.objects.count() == 1
    assert len(mail.outbox) == 1

    email = mail.outbox[0]

    assert email.to == ["guest@example.com"]

    email_content = " ".join(email.body.split())
    assert f"{user.full_name} a partagé un document avec vous!" in email_content
    assert (
        "Docs, votre nouvel outil incontournable pour organiser, partager et collaborer "
        "sur vos documents en équipe." in email_content
    )


def test_api_document_invitations_create_email_full_name_empty():
    """
    If the full name of the user is empty, it will display the email address.
    """
    user = factories.UserFactory(full_name="", language="en-us")
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    invitation_values = {
        "email": "guest@example.com",
        "role": "reader",
    }

    assert len(mail.outbox) == 0

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        invitation_values,
        format="json",
        headers={"Content-Language": "not-supported"},
    )

    assert response.status_code == 201
    assert response.json()["email"] == "guest@example.com"
    assert models.Invitation.objects.count() == 1
    assert len(mail.outbox) == 1

    email = mail.outbox[0]

    assert email.to == ["guest@example.com"]

    email_content = " ".join(email.body.split())
    assert f"{user.email} shared a document with you!" in email_content
    assert (
        f"{user.email.capitalize()} invited you with the role &quot;reader&quot; on the "
        f"following document: {document.title}" in email_content
    )


def test_api_document_invitations_create_issuer_and_document_override():
    """It should not be possible to set the "document" and "issuer" fields."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")])
    other_document = factories.DocumentFactory(users=[(user, "owner")])
    invitation_values = {
        "document": str(other_document.id),
        "issuer": str(factories.UserFactory().id),
        "email": "guest@example.com",
        "role": random.choice(models.RoleChoices.values),
    }

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        invitation_values,
        format="json",
    )

    assert response.status_code == 201
    # document and issuer automatically set
    assert response.json()["document"] == str(document.id)
    assert response.json()["issuer"] == str(user.id)


def test_api_document_invitations_create_cannot_duplicate_invitation():
    """An email should not be invited multiple times to the same document."""
    existing_invitation = factories.InvitationFactory()
    document = existing_invitation.document

    # Grant privileged role on the Document to the user
    user = factories.UserFactory()
    models.DocumentAccess.objects.create(
        document=document, user=user, role="administrator"
    )

    # Create a new invitation to the same document with the exact same email address
    invitation_values = {
        "email": existing_invitation.email,
        "role": random.choice(["administrator", "editor", "reader"]),
    }

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        invitation_values,
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "__all__": [
            "Document invitation with this Email address and Document already exists."
        ],
    }


def test_api_document_invitations_create_cannot_invite_existing_users():
    """
    It should not be possible to invite already existing users.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(users=[(user, "owner")])
    existing_user = factories.UserFactory()

    # Build an invitation to the email of an existing identity in the db
    invitation_values = {
        "email": existing_user.email,
        "role": random.choice(models.RoleChoices.values),
    }

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        invitation_values,
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "email": ["This email is already associated to a registered user."]
    }


# Update


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ["administrator", "owner"])
def test_api_document_invitations_update_authenticated_privileged_any_field_except_role(
    role, via, mock_user_teams
):
    """
    Authenticated user can update invitations if they are administrator or owner of the document.
    """
    user = factories.UserFactory()
    invitation = factories.InvitationFactory()

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=invitation.document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=invitation.document, team="lasuite", role=role
        )

    old_invitation_values = serializers.InvitationSerializer(instance=invitation).data
    new_invitation_values = serializers.InvitationSerializer(
        instance=factories.InvitationFactory()
    ).data
    # The update of a role is tested in the next test
    del new_invitation_values["role"]

    client = APIClient()
    client.force_login(user)

    url = (
        f"/api/v1.0/documents/{invitation.document.id!s}/invitations/{invitation.id!s}/"
    )
    response = client.put(url, new_invitation_values, format="json")

    assert response.status_code == 200

    invitation.refresh_from_db()
    invitation_values = serializers.InvitationSerializer(instance=invitation).data

    for key, value in invitation_values.items():
        if key == "email":
            assert value == new_invitation_values[key]
        elif key == "updated_at":
            assert value > old_invitation_values[key]
        else:
            assert value == old_invitation_values[key]


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role_set", models.RoleChoices.values)
@pytest.mark.parametrize("role", ["administrator", "owner"])
def test_api_document_invitations_update_authenticated_privileged_role(
    role, role_set, via, mock_user_teams
):
    """
    Authenticated user can update invitations if they are administrator or owner of the document,
    but only owners can set the invitation role to the "owner" role.
    """
    user = factories.UserFactory()
    invitation = factories.InvitationFactory()
    old_role = invitation.role

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=invitation.document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=invitation.document, team="lasuite", role=role
        )

    new_invitation_values = serializers.InvitationSerializer(instance=invitation).data
    new_invitation_values["role"] = role_set

    client = APIClient()
    client.force_login(user)

    url = (
        f"/api/v1.0/documents/{invitation.document.id!s}/invitations/{invitation.id!s}/"
    )
    response = client.put(url, new_invitation_values, format="json")

    invitation.refresh_from_db()

    if role_set == "owner" and role != "owner":
        assert response.status_code == 400
        assert invitation.role == old_role
        assert response.json() == {
            "role": [
                "Only owners of a document can invite other users as owners.",
            ],
        }
    else:
        assert response.status_code == 200
        assert invitation.role == role_set


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ["reader", "editor"])
def test_api_document_invitations_update_authenticated_unprivileged(
    role, via, mock_user_teams
):
    """
    Authenticated user should not be allowed to update invitations if they are
    simple reader or editor of the document.
    """
    user = factories.UserFactory()
    invitation = factories.InvitationFactory()

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=invitation.document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=invitation.document, team="lasuite", role=role
        )

    old_invitation_values = serializers.InvitationSerializer(instance=invitation).data
    new_invitation_values = serializers.InvitationSerializer(
        instance=factories.InvitationFactory()
    ).data

    client = APIClient()
    client.force_login(user)

    url = (
        f"/api/v1.0/documents/{invitation.document.id!s}/invitations/{invitation.id!s}/"
    )
    response = client.put(url, new_invitation_values, format="json")

    assert response.status_code == 403

    invitation.refresh_from_db()
    invitation_values = serializers.InvitationSerializer(instance=invitation).data

    for key, value in invitation_values.items():
        assert value == old_invitation_values[key]


# Delete


def test_api_document_invitations_delete_anonymous():
    """Anonymous user should not be able to delete invitations."""
    invitation = factories.InvitationFactory()

    response = APIClient().delete(
        f"/api/v1.0/documents/{invitation.document.id!s}/invitations/{invitation.id!s}/",
    )
    assert response.status_code == 401


def test_api_document_invitations_delete_authenticated_outsider():
    """Members unrelated to a document should not be allowed to cancel invitations."""
    user = factories.UserFactory(with_owned_document=True)

    document = factories.DocumentFactory()
    invitation = factories.InvitationFactory(document=document)

    client = APIClient()
    client.force_login(user)

    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/",
    )
    assert response.status_code == 403


@pytest.mark.parametrize("via", VIA)
@pytest.mark.parametrize("role", ["owner", "administrator"])
def test_api_document_invitations_delete_privileged_members(role, via, mock_user_teams):
    """Privileged member should be able to cancel invitation."""
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    invitation = factories.InvitationFactory(document=document)

    client = APIClient()
    client.force_login(user)

    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/",
    )
    assert response.status_code == 204


@pytest.mark.parametrize("role", ["reader", "editor"])
@pytest.mark.parametrize("via", VIA)
def test_api_document_invitations_delete_readers_or_editors(via, role, mock_user_teams):
    """Readers or editors should not be able to cancel invitation."""
    user = factories.UserFactory(with_owned_document=True)
    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    invitation = factories.InvitationFactory(document=document)

    client = APIClient()
    client.force_login(user)

    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/invitations/{invitation.id!s}/",
    )
    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "You do not have permission to perform this action."
    )
