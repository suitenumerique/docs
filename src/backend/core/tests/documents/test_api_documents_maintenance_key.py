"""
The maintenance escrow copy of an encrypted document's key: stored when the
document is encrypted, backfilled or moved to a new maintenance key by a holder,
dropped with the encryption, and never served back.
"""

import base64

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

# [version 0x01][key id: 16 bytes][wrap]
COPY = base64.b64encode(bytes([1]) + bytes(range(16)) + b"wrapped key").decode()
OTHER_COPY = base64.b64encode(bytes([1]) + bytes(16) + b"another wrap").decode()
# The same maintenance key as COPY, wrapped again: what a share returns.
SAME_KEY_COPY = base64.b64encode(
    bytes([1]) + bytes(range(16)) + b"another wrap"
).decode()


def _encrypted_document(user, role, **kwargs):
    document = factories.DocumentFactory(
        link_reach="restricted", is_encrypted=True, **kwargs
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user,
        role=role,
        encrypted_document_symmetric_key_for_user="d3JhcHBlZA==",
        encryption_public_key_version=1,
    )
    return document


def _client(user):
    client = APIClient()
    client.force_login(user)
    return client


def test_api_documents_maintenance_key_stored_on_encrypt():
    """The copy the vault returned to the creator encrypting is stored on the document."""
    owner = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted", creator=owner)
    factories.UserDocumentAccessFactory(document=document, user=owner, role="owner")

    response = _client(owner).patch(
        f"/api/v1.0/documents/{document.id!s}/encrypt/",
        {
            "content": "ZW5jcnlwdGVk",
            "encryptedSymmetricKeyPerUser": {owner.sub: "d3JhcHBlZA=="},
            "encryptionPublicKeyVersionPerUser": {owner.sub: 1},
            "maintenanceKey": COPY,
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["has_maintenance_key"] is True
    assert "maintenance_wrapped_document_key" not in response.json()
    document.refresh_from_db()
    assert document.maintenance_wrapped_document_key == COPY


@pytest.mark.parametrize("role", ["administrator", "owner"])
def test_api_documents_maintenance_key_not_stored_when_encrypted_by_another(role):
    """
    The vault escrows for the caller's organization: from anyone but the creator,
    the copy would be another organization's. Left empty, for the backfill, which
    the response allows: it names the creator.
    """
    creator = factories.UserFactory()
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted", creator=creator)
    factories.UserDocumentAccessFactory(document=document, user=creator, role="owner")
    factories.UserDocumentAccessFactory(document=document, user=user, role=role)

    response = _client(user).patch(
        f"/api/v1.0/documents/{document.id!s}/encrypt/",
        {
            "content": "ZW5jcnlwdGVk",
            "encryptedSymmetricKeyPerUser": {
                user.sub: "d3JhcHBlZA==",
                creator.sub: "d3JhcHBlZA==",
            },
            "encryptionPublicKeyVersionPerUser": {user.sub: 1, creator.sub: 1},
            "maintenanceKey": COPY,
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["has_maintenance_key"] is False
    assert response.json()["creator_sub"] == str(creator.sub)
    assert response.json()["abilities"]["maintenance_key"] is True
    document.refresh_from_db()
    assert document.is_encrypted is True
    assert document.maintenance_wrapped_document_key is None


def test_api_documents_maintenance_key_optional_on_encrypt():
    """A deployment without the escrow encrypts without a copy."""
    owner = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=owner, role="owner")

    response = _client(owner).patch(
        f"/api/v1.0/documents/{document.id!s}/encrypt/",
        {
            "content": "ZW5jcnlwdGVk",
            "encryptedSymmetricKeyPerUser": {owner.sub: "d3JhcHBlZA=="},
            "encryptionPublicKeyVersionPerUser": {owner.sub: 1},
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["has_maintenance_key"] is False


def test_api_documents_maintenance_key_malformed_refused_on_encrypt():
    """Encrypting with something that cannot be a maintenance copy is refused."""
    owner = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=owner, role="owner")

    response = _client(owner).patch(
        f"/api/v1.0/documents/{document.id!s}/encrypt/",
        {
            "content": "ZW5jcnlwdGVk",
            "encryptedSymmetricKeyPerUser": {owner.sub: "d3JhcHBlZA=="},
            "encryptionPublicKeyVersionPerUser": {owner.sub: 1},
            "maintenanceKey": "d3JhcHBlZA==",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "maintenanceKey" in response.json()
    document.refresh_from_db()
    assert document.is_encrypted is False


def test_api_documents_maintenance_key_cleared_on_remove_encryption():
    """Removing the encryption drops the copy: there is nothing left to recover."""
    owner = factories.UserFactory()
    document = _encrypted_document(
        owner, "owner", maintenance_wrapped_document_key=COPY
    )

    response = _client(owner).patch(
        f"/api/v1.0/documents/{document.id!s}/remove-encryption/",
        {"content": "cGxhaW4="},
        format="json",
    )

    assert response.status_code == 200
    document.refresh_from_db()
    assert document.maintenance_wrapped_document_key is None


@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
def test_api_documents_maintenance_key_fill(role):
    """Anyone who can edit fills an empty copy (the backfill), without it counting as an edit."""
    user = factories.UserFactory()
    document = _encrypted_document(user, role)
    updated_at = document.updated_at

    response = _client(user).patch(
        f"/api/v1.0/documents/{document.id!s}/maintenance-key/",
        {"maintenanceKey": COPY},
        format="json",
    )

    assert response.status_code == 204
    document.refresh_from_db()
    assert document.maintenance_wrapped_document_key == COPY
    assert document.updated_at == updated_at


@pytest.mark.parametrize("role", ["administrator", "owner"])
def test_api_documents_maintenance_key_replace(role, caplog):
    """
    An owner or an administrator replaces a copy made for another maintenance key
    (the organization moved to a new one), logged.
    """
    user = factories.UserFactory()
    document = _encrypted_document(user, role, maintenance_wrapped_document_key=COPY)
    updated_at = document.updated_at

    with caplog.at_level("WARNING", logger="core.api.viewsets"):
        response = _client(user).patch(
            f"/api/v1.0/documents/{document.id!s}/maintenance-key/",
            {"maintenanceKey": OTHER_COPY},
            format="json",
        )

    assert response.status_code == 204
    document.refresh_from_db()
    assert document.maintenance_wrapped_document_key == OTHER_COPY
    assert document.updated_at == updated_at
    assert (
        f"Maintenance copy of document {document.pk} replaced by user {user.pk}: "
        f"key {bytes(range(16)).hex()}, now {bytes(16).hex()}"
    ) in caplog.text


@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
def test_api_documents_maintenance_key_same_key_refused(role):
    """
    A copy for the key the stored one is already for brings nothing (a share
    changes neither the document key nor its owner): refused, the stored one kept.
    """
    user = factories.UserFactory()
    document = _encrypted_document(user, role, maintenance_wrapped_document_key=COPY)
    updated_at = document.updated_at

    response = _client(user).patch(
        f"/api/v1.0/documents/{document.id!s}/maintenance-key/",
        {"maintenanceKey": SAME_KEY_COPY},
        format="json",
    )

    assert response.status_code == 409
    assert response.json()["code"] == "maintenance_key_already_stored"
    document.refresh_from_db()
    assert document.maintenance_wrapped_document_key == COPY
    assert document.updated_at == updated_at


def test_api_documents_maintenance_key_replace_forbidden_to_editors():
    """
    An editor cannot replace a copy: it decides which organization's custodians can
    read the document.
    """
    user = factories.UserFactory()
    document = _encrypted_document(
        user, "editor", maintenance_wrapped_document_key=COPY
    )

    response = _client(user).patch(
        f"/api/v1.0/documents/{document.id!s}/maintenance-key/",
        {"maintenanceKey": OTHER_COPY},
        format="json",
    )

    assert response.status_code == 403
    document.refresh_from_db()
    assert document.maintenance_wrapped_document_key == COPY


@pytest.mark.parametrize("role", ["reader", "commenter"])
def test_api_documents_maintenance_key_update_forbidden_to_readers(role):
    """A member who cannot edit the document cannot replace its copy."""
    user = factories.UserFactory()
    document = _encrypted_document(user, role)

    response = _client(user).patch(
        f"/api/v1.0/documents/{document.id!s}/maintenance-key/",
        {"maintenanceKey": COPY},
        format="json",
    )

    assert response.status_code == 403
    document.refresh_from_db()
    assert document.maintenance_wrapped_document_key is None


def test_api_documents_maintenance_key_update_anonymous():
    """Anonymous users cannot store a copy."""
    document = factories.DocumentFactory(link_reach="restricted", is_encrypted=True)

    response = APIClient().patch(
        f"/api/v1.0/documents/{document.id!s}/maintenance-key/",
        {"maintenanceKey": COPY},
        format="json",
    )

    assert response.status_code == 401


def test_api_documents_maintenance_key_update_plain_document_refused():
    """A document that is not encrypted has no key to escrow."""
    owner = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted", users=[(owner, models.RoleChoices.OWNER)]
    )

    response = _client(owner).patch(
        f"/api/v1.0/documents/{document.id!s}/maintenance-key/",
        {"maintenanceKey": COPY},
        format="json",
    )

    assert response.status_code == 403
    document.refresh_from_db()
    assert document.maintenance_wrapped_document_key is None


@pytest.mark.parametrize(
    "value",
    [
        "not base64!",
        "",
        base64.b64encode(bytes([1]) + bytes(16)).decode(),  # header only
        base64.b64encode(bytes([2]) + bytes(32)).decode(),  # unknown version
    ],
)
def test_api_documents_maintenance_key_update_malformed_refused(value):
    """Only something shaped like a maintenance copy is stored."""
    owner = factories.UserFactory()
    document = _encrypted_document(owner, "owner")

    response = _client(owner).patch(
        f"/api/v1.0/documents/{document.id!s}/maintenance-key/",
        {"maintenanceKey": value},
        format="json",
    )

    assert response.status_code == 400
    document.refresh_from_db()
    assert document.maintenance_wrapped_document_key is None


def test_api_documents_maintenance_key_retrieve_fields():
    """The detail view says whether the copy exists and names the creator, never serves the copy."""
    owner = factories.UserFactory()
    document = _encrypted_document(owner, "owner", creator=owner)
    client = _client(owner)

    data = client.get(f"/api/v1.0/documents/{document.id!s}/").json()

    assert data["has_maintenance_key"] is False
    assert data["creator_sub"] == str(owner.sub)
    assert "maintenance_wrapped_document_key" not in data

    document.maintenance_wrapped_document_key = COPY
    document.save()

    assert (
        client.get(f"/api/v1.0/documents/{document.id!s}/").json()[
            "has_maintenance_key"
        ]
        is True
    )


def test_api_documents_maintenance_key_creator_sub_hidden_on_plain_documents():
    """The creator's sub only serves the escrow, so plain documents do not expose it."""
    owner = factories.UserFactory()
    document = factories.DocumentFactory(
        link_reach="restricted",
        users=[(owner, models.RoleChoices.OWNER)],
        creator=owner,
    )

    data = _client(owner).get(f"/api/v1.0/documents/{document.id!s}/").json()

    assert data["creator_sub"] is None
    assert data["has_maintenance_key"] is False
