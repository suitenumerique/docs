"""
Test restoring documents after a soft delete via the detail action API endpoint.
"""

from datetime import timedelta

from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


def test_api_documents_restore_anonymous_user():
    """Anonymous users should not be able to restore deleted documents."""
    now = timezone.now() - timedelta(days=15)
    document = factories.DocumentFactory(deleted_at=now)

    response = APIClient().post(f"/api/v1.0/documents/{document.id!s}/restore/")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}

    document.refresh_from_db()
    assert document.deleted_at == now
    assert document.ancestors_deleted_at == now


@pytest.mark.parametrize("role", [None, "reader", "editor", "administrator"])
def test_api_documents_restore_authenticated_no_permission(role):
    """
    Authenticated users who are not owners of a deleted document should
    not be allowed to restore it.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    now = timezone.now() - timedelta(days=15)
    document = factories.DocumentFactory(
        deleted_at=now, link_reach="public", link_role="editor"
    )
    if role:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)

    response = client.post(f"/api/v1.0/documents/{document.id!s}/restore/")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}

    document.refresh_from_db()
    assert document.deleted_at == now
    assert document.ancestors_deleted_at == now


def test_api_documents_restore_authenticated_owner_success():
    """The owner of a deleted document should be able to restore it."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    now = timezone.now() - timedelta(days=15)
    document = factories.DocumentFactory(deleted_at=now)
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    response = client.post(f"/api/v1.0/documents/{document.id!s}/restore/")

    assert response.status_code == 200
    assert response.json() == {"detail": "Document has been successfully restored."}

    document.refresh_from_db()
    assert document.deleted_at is None
    assert document.ancestors_deleted_at is None


def test_api_documents_restore_authenticated_owner_ancestor_deleted():
    """
    The restored document should still be marked as deleted if one of its
    ancestors is soft deleted as well.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory()
    parent = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(parent=parent)
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    document.soft_delete()
    document_deleted_at = document.deleted_at
    assert document_deleted_at is not None

    grand_parent.soft_delete()
    grand_parent_deleted_at = grand_parent.deleted_at
    assert grand_parent_deleted_at is not None

    response = client.post(f"/api/v1.0/documents/{document.id!s}/restore/")

    assert response.status_code == 200
    assert response.json() == {"detail": "Document has been successfully restored."}

    document.refresh_from_db()
    assert document.deleted_at is None
    # document is still marked as deleted
    assert document.ancestors_deleted_at == grand_parent_deleted_at
    assert grand_parent_deleted_at > document_deleted_at


def test_api_documents_restore_authenticated_owner_expired():
    """It should not be possible to restore a document beyond the allowed time limit."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    now = timezone.now() - timedelta(days=40)
    document = factories.DocumentFactory(deleted_at=now)
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    response = client.post(f"/api/v1.0/documents/{document.id!s}/restore/")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}
