"""
Test restoring documents after a soft delete via the detail action API endpoint.
"""

from datetime import timedelta

from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_api_documents_restore_anonymous_user():
    """Anonymous users should not be able to restore deleted documents."""
    now = timezone.now() - timedelta(days=15)
    document = factories.DocumentFactory(deleted_at=now)

    response = APIClient().post(f"/api/v1.0/documents/{document.id!s}/restore/")

    assert response.status_code == 404
    assert response.json() == {"detail": "No Document matches the given query."}
    assert models.Document.objects.get().deleted_at == now


@pytest.mark.parametrize("role", [None, "reader", "editor", "administrator"])
def test_api_documents_restore_authenticated_no_permission(role):
    """
    Authenticated users who are not owners of a deleted document should
    not be able to restore it.
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
    assert response.json() == {"detail": "No Document matches the given query."}


def test_api_documents_restore_authenticated_success():
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


def test_api_documents_restore_expired():
    """Attempting to restore a document deleted beyond the allowed time frame should fail."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    now = timezone.now() - timedelta(days=40)
    document = factories.DocumentFactory(deleted_at=now)
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    response = client.post(f"/api/v1.0/documents/{document.id!s}/restore/")

    assert response.status_code == 404
    assert response.json() == {"detail": "No Document matches the given query."}
