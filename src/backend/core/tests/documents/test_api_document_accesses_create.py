"""
Test document accesses API endpoints for users in impress's core app.
"""

import random

from django.core import mail

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import serializers
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


# Create


def test_api_document_accesses_create_anonymous():
    """Anonymous users should not be allowed to create document accesses."""
    document = factories.DocumentFactory()

    other_user = factories.UserFactory()
    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/accesses/",
        {
            "user_id": str(other_user.id),
            "document": str(document.id),
            "role": random.choice(models.RoleChoices.values),
        },
        format="json",
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }
    assert models.DocumentAccess.objects.exists() is False


def test_api_document_accesses_create_authenticated_unrelated():
    """
    Authenticated users should not be allowed to create document accesses for a document to
    which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    document = factories.DocumentFactory()

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/accesses/",
        {
            "user_id": str(other_user.id),
        },
        format="json",
    )

    assert response.status_code == 403
    assert not models.DocumentAccess.objects.filter(user=other_user).exists()


@pytest.mark.parametrize("role", ["reader", "editor"])
@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_create_authenticated_reader_or_editor(
    via, role, mock_user_teams
):
    """Readers or editors of a document should not be allowed to create document accesses."""
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

    other_user = factories.UserFactory()

    for new_role in [role[0] for role in models.RoleChoices.choices]:
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/accesses/",
            {
                "user_id": str(other_user.id),
                "role": new_role,
            },
            format="json",
        )

        assert response.status_code == 403

    assert not models.DocumentAccess.objects.filter(user=other_user).exists()


@pytest.mark.parametrize("depth", [1, 2, 3])
@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_create_authenticated_administrator(
    via, depth, mock_user_teams
):
    """
    Administrators of a document (direct or by heritage) should be able to create
    document accesses except for the "owner" role.
    An email should be sent to the accesses to notify them of the adding.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    documents = []
    for i in range(depth):
        parent = documents[i - 1] if i > 0 else None
        documents.append(factories.DocumentFactory(parent=parent))

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=documents[0], user=user, role="administrator"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=documents[0], team="lasuite", role="administrator"
        )

    other_user = factories.UserFactory(language="en-us")
    document = documents[-1]
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/accesses/",
        {
            "user_id": str(other_user.id),
            "role": "owner",
        },
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only owners of a document can assign other users as owners."
    }

    # It should be allowed to create a lower access
    role = random.choice(
        [role[0] for role in models.RoleChoices.choices if role[0] != "owner"]
    )

    assert len(mail.outbox) == 0

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/accesses/",
        {
            "user_id": str(other_user.id),
            "role": role,
        },
        format="json",
    )

    assert response.status_code == 201
    assert models.DocumentAccess.objects.filter(user=other_user).count() == 1
    new_document_access = models.DocumentAccess.objects.filter(user=other_user).get()
    other_user = serializers.UserSerializer(instance=other_user).data
    assert response.json() == {
        "abilities": new_document_access.get_abilities(user),
        "document_id": str(new_document_access.document_id),
        "id": str(new_document_access.id),
        "team": "",
        "role": role,
        "max_ancestors_role": None,
        "user": other_user,
    }
    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == [other_user["email"]]
    email_content = " ".join(email.body.split())
    assert f"{user.full_name} shared a document with you!" in email_content
    assert (
        f"{user.full_name} ({user.email}) invited you with the role &quot;{role}&quot; "
        f"on the following document: {document.title}"
    ) in email_content
    assert "docs/" + str(document.id) + "/" in email_content


@pytest.mark.parametrize("depth", [1, 2, 3])
@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_create_authenticated_owner(via, depth, mock_user_teams):
    """
    Owners of a document (direct or by heritage) should be able to create document accesses
    whatever the role. An email should be sent to the accesses to notify them of the adding.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    documents = []
    for i in range(depth):
        parent = documents[i - 1] if i > 0 else None
        documents.append(factories.DocumentFactory(parent=parent))

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=documents[0], user=user, role="owner"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=documents[0], team="lasuite", role="owner"
        )

    other_user = factories.UserFactory(language="en-us")
    document = documents[-1]
    role = random.choice([role[0] for role in models.RoleChoices.choices])

    assert len(mail.outbox) == 0

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/accesses/",
        {
            "user_id": str(other_user.id),
            "role": role,
        },
        format="json",
    )

    assert response.status_code == 201
    assert models.DocumentAccess.objects.filter(user=other_user).count() == 1
    new_document_access = models.DocumentAccess.objects.filter(user=other_user).get()
    other_user = serializers.UserSerializer(instance=other_user).data
    assert response.json() == {
        "document_id": str(new_document_access.document_id),
        "id": str(new_document_access.id),
        "user": other_user,
        "team": "",
        "role": role,
        "max_ancestors_role": None,
        "abilities": new_document_access.get_abilities(user),
    }
    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == [other_user["email"]]
    email_content = " ".join(email.body.split())
    assert f"{user.full_name} shared a document with you!" in email_content
    assert (
        f"{user.full_name} ({user.email}) invited you with the role &quot;{role}&quot; "
        f"on the following document: {document.title}"
    ) in email_content
    assert "docs/" + str(document.id) + "/" in email_content


@pytest.mark.parametrize("via", VIA)
def test_api_document_accesses_create_email_in_receivers_language(via, mock_user_teams):
    """
    The email sent to the accesses to notify them of the adding, should be in their language.
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

    role = random.choice([role[0] for role in models.RoleChoices.choices])

    assert len(mail.outbox) == 0

    other_users = (
        factories.UserFactory(language="en-us"),
        factories.UserFactory(language="fr-fr"),
    )

    for index, other_user in enumerate(other_users):
        expected_language = other_user.language
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/accesses/",
            {
                "user_id": str(other_user.id),
                "role": role,
            },
            format="json",
        )

        assert response.status_code == 201
        assert models.DocumentAccess.objects.filter(user=other_user).count() == 1
        new_document_access = models.DocumentAccess.objects.filter(
            user=other_user
        ).get()
        other_user_data = serializers.UserSerializer(instance=other_user).data
        assert response.json() == {
            "document_id": str(new_document_access.document_id),
            "id": str(new_document_access.id),
            "user": other_user_data,
            "team": "",
            "role": role,
            "max_ancestors_role": None,
            "abilities": new_document_access.get_abilities(user),
        }
        assert len(mail.outbox) == index + 1
        email = mail.outbox[index]
        assert email.to == [other_user_data["email"]]
        email_content = " ".join(email.body.split())
        email_subject = " ".join(email.subject.split())
        if expected_language == "en-us":
            assert (
                f"{user.full_name} shared a document with you: {document.title}".lower()
                in email_subject.lower()
            )
        elif expected_language == "fr-fr":
            assert (
                f"{user.full_name} a partagé un document avec vous : {document.title}".lower()
                in email_subject.lower()
            )
        assert "docs/" + str(document.id) + "/" in email_content.lower()
