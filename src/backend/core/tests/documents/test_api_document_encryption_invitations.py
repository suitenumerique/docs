"""
Invitations on encrypted documents: an invitee has no account, hence no
encryption key, so their invitation turns into a pending access (no wrapped
key) when they sign up, like any member added without encryption.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def _owned_encrypted_document(owner):
    document = factories.DocumentFactory(link_reach="restricted", is_encrypted=True)
    factories.UserDocumentAccessFactory(
        document=document,
        user=owner,
        role="owner",
        encrypted_document_symmetric_key_for_user="d3JhcHBlZA==",
        encryption_public_key_version=1,
    )
    return document


def test_api_document_encryption_invitations_do_not_block_encrypting():
    """A document with pending invitations can be encrypted."""
    owner = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=owner, role="owner")
    factories.InvitationFactory(document=document, issuer=owner)

    client = APIClient()
    client.force_login(owner)
    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/encrypt/",
        {
            "content": "ZW5jcnlwdGVk",
            "encryptedSymmetricKeyPerUser": {owner.sub: "d3JhcHBlZA=="},
            "encryptionPublicKeyVersionPerUser": {owner.sub: 1},
        },
        format="json",
    )

    assert response.status_code == 200
    document.refresh_from_db()
    assert document.is_encrypted is True
    assert document.invitations.count() == 1


def test_api_document_encryption_invitations_create_and_update():
    """Invitations can be created and updated on an encrypted document."""
    owner = factories.UserFactory()
    document = _owned_encrypted_document(owner)

    client = APIClient()
    client.force_login(owner)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/invitations/",
        {"email": "newcomer@example.com", "role": "reader"},
        format="json",
    )
    assert response.status_code == 201

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/invitations/{response.json()['id']}/",
        {"role": "editor"},
        format="json",
    )
    assert response.status_code == 200
    assert models.Invitation.objects.get(document=document).role == "editor"


def test_api_document_encryption_invitations_become_pending_accesses():
    """Signing up turns the invitation into an access with no wrapped key."""
    owner = factories.UserFactory()
    document = _owned_encrypted_document(owner)
    factories.InvitationFactory(
        document=document, issuer=owner, email="newcomer@example.com"
    )

    newcomer = factories.UserFactory(email="newcomer@example.com")

    access = models.DocumentAccess.objects.get(document=document, user=newcomer)
    assert access.encrypted_document_symmetric_key_for_user is None
