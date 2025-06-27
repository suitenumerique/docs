"""Test API for document ask for access."""

import uuid

from django.core import mail

import pytest
from rest_framework.test import APIClient

from core.api.serializers import UserSerializer
from core.factories import (
    DocumentAskForAccessFactory,
    DocumentFactory,
    UserDocumentAccessFactory,
    UserFactory,
)
from core.models import DocumentAccess, DocumentAskForAccess, RoleChoices

pytestmark = pytest.mark.django_db

## Create


def test_api_documents_ask_for_access_create_anonymous():
    """Anonymous users should not be able to create a document ask for access."""
    document = DocumentFactory()

    client = APIClient()
    response = client.post(f"/api/v1.0/documents/{document.id}/ask-for-access/")

    assert response.status_code == 401


def test_api_documents_ask_for_access_create_invalid_document_id():
    """Invalid document ID should return a 404 error."""
    user = UserFactory()

    client = APIClient()
    client.force_login(user)
    response = client.post(f"/api/v1.0/documents/{uuid.uuid4()}/ask-for-access/")

    assert response.status_code == 404


def test_api_documents_ask_for_access_create_authenticated():
    """
    Authenticated users should be able to create a document ask for access.
    An email should be sent to document owners and admins to notify them.
    """
    owner_user = UserFactory(language="en-us")
    admin_user = UserFactory(language="fr-fr")
    document = DocumentFactory(
        users=[
            (owner_user, RoleChoices.OWNER),
            (admin_user, RoleChoices.ADMIN),
        ]
    )

    user = UserFactory()

    client = APIClient()
    client.force_login(user)

    assert len(mail.outbox) == 0

    response = client.post(f"/api/v1.0/documents/{document.id}/ask-for-access/")
    assert response.status_code == 201

    assert DocumentAskForAccess.objects.filter(
        document=document,
        user=user,
        role=RoleChoices.READER,
    ).exists()

    # Verify emails were sent to both owner and admin
    assert len(mail.outbox) == 2

    # Check that emails were sent to the right recipients
    email_recipients = [email.to[0] for email in mail.outbox]
    assert owner_user.email in email_recipients
    assert admin_user.email in email_recipients

    # Check email content for both users
    for email in mail.outbox:
        email_content = " ".join(email.body.split())
        email_subject = " ".join(email.subject.split())

        # Check that the requesting user's name is in the email
        user_name = user.full_name or user.email
        assert user_name.lower() in email_content.lower()

        # Check that the subject mentions access request
        assert "access" in email_subject.lower()

        # Check that the document title is mentioned if it exists
        if document.title:
            assert document.title.lower() in email_subject.lower()


def test_api_documents_ask_for_access_create_authenticated_specific_role():
    """
    Authenticated users should be able to create a document ask for access with a specific role.
    """
    document = DocumentFactory()
    user = UserFactory()

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/",
        data={"role": RoleChoices.EDITOR},
    )
    assert response.status_code == 201

    assert DocumentAskForAccess.objects.filter(
        document=document,
        user=user,
        role=RoleChoices.EDITOR,
    ).exists()


def test_api_documents_ask_for_access_create_authenticated_already_has_access():
    """Authenticated users with existing access can ask for access with a different role."""
    user = UserFactory()
    document = DocumentFactory(users=[(user, RoleChoices.READER)])

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/",
        data={"role": RoleChoices.EDITOR},
    )
    assert response.status_code == 201

    assert DocumentAskForAccess.objects.filter(
        document=document,
        user=user,
        role=RoleChoices.EDITOR,
    ).exists()


def test_api_documents_ask_for_access_create_authenticated_already_has_ask_for_access():
    """
    Authenticated users with existing ask for access can not ask for a new access on this document.
    """
    user = UserFactory()
    document = DocumentFactory(users=[(user, RoleChoices.READER)])
    DocumentAskForAccessFactory(document=document, user=user, role=RoleChoices.READER)

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/",
        data={"role": RoleChoices.EDITOR},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "You already ask to access to this document."}


## List


def test_api_documents_ask_for_access_list_anonymous():
    """Anonymous users should not be able to list document ask for access."""
    document = DocumentFactory()
    DocumentAskForAccessFactory.create_batch(
        3, document=document, role=RoleChoices.READER
    )

    client = APIClient()
    response = client.get(f"/api/v1.0/documents/{document.id}/ask-for-access/")

    assert response.status_code == 401


def test_api_documents_ask_for_access_list_authenticated():
    """Authenticated users should be able to list document ask for access."""
    document = DocumentFactory()
    DocumentAskForAccessFactory.create_batch(
        3, document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(UserFactory())

    response = client.get(f"/api/v1.0/documents/{document.id}/ask-for-access/")
    assert response.status_code == 200
    assert response.json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }


def test_api_documents_ask_for_access_list_authenticated_own_request():
    """Authenticated users should be able to list their own document ask for access."""
    document = DocumentFactory()
    DocumentAskForAccessFactory.create_batch(
        3, document=document, role=RoleChoices.READER
    )

    user = UserFactory()
    user_data = UserSerializer(instance=user).data

    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, user=user, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id}/ask-for-access/")
    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": str(document_ask_for_access.id),
                "document": str(document.id),
                "user": user_data,
                "role": RoleChoices.READER,
                "created_at": document_ask_for_access.created_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "abilities": {
                    "accept": False,
                    "destroy": False,
                    "update": False,
                    "partial_update": False,
                    "retrieve": False,
                },
            }
        ],
    }


def test_api_documents_ask_for_access_list_authenticated_other_document():
    """Authenticated users should not be able to list document ask for access of other documents."""
    document = DocumentFactory()
    DocumentAskForAccessFactory.create_batch(
        3, document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(UserFactory())

    other_document = DocumentFactory()
    DocumentAskForAccessFactory.create_batch(
        3, document=other_document, role=RoleChoices.READER
    )

    response = client.get(f"/api/v1.0/documents/{other_document.id}/ask-for-access/")
    assert response.status_code == 200
    assert response.json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }


@pytest.mark.parametrize("role", [RoleChoices.READER, RoleChoices.EDITOR])
def test_api_documents_ask_for_access_list_non_owner_or_admin(role):
    """Non owner or admin users should not be able to list document ask for access."""

    user = UserFactory()

    document = DocumentFactory(users=[(user, role)])
    DocumentAskForAccessFactory.create_batch(
        3, document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id}/ask-for-access/")
    assert response.status_code == 200
    assert response.json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }


@pytest.mark.parametrize("role", [RoleChoices.OWNER])
def test_api_documents_ask_for_access_list_owner_or_admin(role):
    """Owner or admin users should be able to list document ask for access."""
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_ask_for_accesses = DocumentAskForAccessFactory.create_batch(
        3, document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(user)

    response = client.get(f"/api/v1.0/documents/{document.id}/ask-for-access/")
    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": str(document_ask_for_access.id),
                "document": str(document.id),
                "user": UserSerializer(instance=document_ask_for_access.user).data,
                "role": RoleChoices.READER,
                "created_at": document_ask_for_access.created_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "abilities": {
                    "accept": True,
                    "destroy": True,
                    "update": True,
                    "partial_update": True,
                    "retrieve": True,
                },
            }
            for document_ask_for_access in document_ask_for_accesses
        ],
    }


## Retrieve


def test_api_documents_ask_for_access_retrieve_anonymous():
    """Anonymous users should not be able to retrieve document ask for access."""
    document = DocumentFactory()
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/"
    )
    assert response.status_code == 401


def test_api_documents_ask_for_access_retrieve_authenticated():
    """Authenticated users should not be able to retrieve document ask for access."""
    document = DocumentFactory()
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(UserFactory())

    response = client.get(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/"
    )
    assert response.status_code == 404


@pytest.mark.parametrize("role", [RoleChoices.READER, RoleChoices.EDITOR])
def test_api_documents_ask_for_access_retrieve_authenticated_non_owner_or_admin(role):
    """Non owner or admin users should not be able to retrieve document ask for access."""
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(user)

    response = client.get(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/"
    )
    assert response.status_code == 404


@pytest.mark.parametrize("role", [RoleChoices.OWNER, RoleChoices.ADMIN])
def test_api_documents_ask_for_access_retrieve_owner_or_admin(role):
    """Owner or admin users should be able to retrieve document ask for access."""
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )
    user_data = UserSerializer(instance=document_ask_for_access.user).data

    client = APIClient()
    client.force_login(user)

    response = client.get(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/"
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": str(document_ask_for_access.id),
        "document": str(document.id),
        "user": user_data,
        "role": RoleChoices.READER,
        "created_at": document_ask_for_access.created_at.isoformat().replace(
            "+00:00", "Z"
        ),
        "abilities": {
            "accept": True,
            "destroy": True,
            "update": True,
            "partial_update": True,
            "retrieve": True,
        },
    }


## Delete


def test_api_documents_ask_for_access_delete_anonymous():
    """Anonymous users should not be able to delete document ask for access."""
    document = DocumentFactory()
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    response = client.delete(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/"
    )
    assert response.status_code == 401


def test_api_documents_ask_for_access_delete_authenticated():
    """Authenticated users should not be able to delete document ask for access."""
    document = DocumentFactory()
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(UserFactory())

    response = client.delete(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/"
    )
    assert response.status_code == 404


@pytest.mark.parametrize("role", [RoleChoices.READER, RoleChoices.EDITOR])
def test_api_documents_ask_for_access_delete_authenticated_non_owner_or_admin(role):
    """Non owner or admin users should not be able to delete document ask for access."""
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(user)

    response = client.delete(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/"
    )
    assert response.status_code == 404


@pytest.mark.parametrize("role", [RoleChoices.OWNER, RoleChoices.ADMIN])
def test_api_documents_ask_for_access_delete_owner_or_admin(role):
    """Owner or admin users should be able to delete document ask for access."""
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(user)

    response = client.delete(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/"
    )
    assert response.status_code == 204
    assert not DocumentAskForAccess.objects.filter(
        id=document_ask_for_access.id
    ).exists()


## Accept


def test_api_documents_ask_for_access_accept_anonymous():
    """Anonymous users should not be able to accept document ask for access."""
    document = DocumentFactory()
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/accept/"
    )
    assert response.status_code == 401


def test_api_documents_ask_for_access_accept_authenticated():
    """Authenticated users should not be able to accept document ask for access."""
    document = DocumentFactory()
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(UserFactory())
    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/accept/"
    )
    assert response.status_code == 404


@pytest.mark.parametrize("role", [RoleChoices.READER, RoleChoices.EDITOR])
def test_api_documents_ask_for_access_accept_authenticated_non_owner_or_admin(role):
    """Non owner or admin users should not be able to accept document ask for access."""
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/accept/"
    )
    assert response.status_code == 404


@pytest.mark.parametrize("role", [RoleChoices.OWNER, RoleChoices.ADMIN])
def test_api_documents_ask_for_access_accept_owner_or_admin(role):
    """Owner or admin users should be able to accept document ask for access."""
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/accept/"
    )
    assert response.status_code == 204

    assert not DocumentAskForAccess.objects.filter(
        id=document_ask_for_access.id
    ).exists()
    assert DocumentAccess.objects.filter(
        document=document, user=document_ask_for_access.user, role=RoleChoices.READER
    ).exists()


@pytest.mark.parametrize("role", [RoleChoices.OWNER, RoleChoices.ADMIN])
def test_api_documents_ask_for_access_accept_authenticated_specific_role(role):
    """
    Owner or admin users should be able to accept document ask for access with a specific role.
    """
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/accept/",
        data={"role": RoleChoices.EDITOR},
    )
    assert response.status_code == 204

    assert not DocumentAskForAccess.objects.filter(
        id=document_ask_for_access.id
    ).exists()
    assert DocumentAccess.objects.filter(
        document=document, user=document_ask_for_access.user, role=RoleChoices.EDITOR
    ).exists()


@pytest.mark.parametrize("role", [RoleChoices.OWNER, RoleChoices.ADMIN])
def test_api_documents_ask_for_access_accept_authenticated_owner_or_admin_update_access(
    role,
):
    """
    Owner or admin users should be able to accept document ask for access and update the access.
    """
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_access = UserDocumentAccessFactory(
        document=document, role=RoleChoices.READER
    )
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, user=document_access.user, role=RoleChoices.EDITOR
    )

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/accept/",
        data={"role": RoleChoices.EDITOR},
    )
    assert response.status_code == 204

    assert not DocumentAskForAccess.objects.filter(
        id=document_ask_for_access.id
    ).exists()
    document_access.refresh_from_db()
    assert document_access.role == RoleChoices.EDITOR


@pytest.mark.parametrize("role", [RoleChoices.OWNER, RoleChoices.ADMIN])
# pylint: disable=line-too-long
def test_api_documents_ask_for_access_accept_authenticated_owner_or_admin_update_access_with_specific_role(
    role,
):
    """
    Owner or admin users should be able to accept document ask for access and update the access
    with a specific role.
    """
    user = UserFactory()
    document = DocumentFactory(users=[(user, role)])
    document_access = UserDocumentAccessFactory(
        document=document, role=RoleChoices.READER
    )
    document_ask_for_access = DocumentAskForAccessFactory(
        document=document, user=document_access.user, role=RoleChoices.EDITOR
    )

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id}/ask-for-access/{document_ask_for_access.id}/accept/",
        data={"role": RoleChoices.ADMIN},
    )
    assert response.status_code == 204

    assert not DocumentAskForAccess.objects.filter(
        id=document_ask_for_access.id
    ).exists()
    document_access.refresh_from_db()
    assert document_access.role == RoleChoices.ADMIN
