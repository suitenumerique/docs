"""
Tests for Documents API endpoint in impress's core app: delete
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


def test_api_documents_delete_anonymous():
    """Anonymous users should not be allowed to destroy a document."""
    document = factories.DocumentFactory()

    response = APIClient().delete(
        f"/api/v1.0/documents/{document.id!s}/",
    )

    assert response.status_code == 401
    assert models.Document.objects.count() == 1


@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
def test_api_documents_delete_authenticated_unrelated(reach, role):
    """
    Authenticated users should not be allowed to delete a document to which
    they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)

    response = client.delete(
        f"/api/v1.0/documents/{document.id!s}/",
    )

    assert response.status_code == 403
    assert models.Document.objects.count() == 2


@pytest.mark.parametrize("role", ["reader", "editor", "administrator"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_delete_authenticated_not_owner(via, role, mock_user_teams):
    """
    Authenticated users should not be allowed to delete a document for which they are
    only a reader, editor or administrator.
    """
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

    response = client.delete(
        f"/api/v1.0/documents/{document.id}/",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    assert models.Document.objects.count() == 2


@pytest.mark.parametrize("depth", [1, 2, 3])
def test_api_documents_delete_authenticated_owner_of_ancestor(depth):
    """
    Authenticated users should not be able to delete a document for which
    they are only owner of an ancestor.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    documents = []
    for i in range(depth):
        documents.append(
            factories.UserDocumentAccessFactory(role="owner", user=user).document
            if i == 0
            else factories.DocumentFactory(parent=documents[-1])
        )
    assert models.Document.objects.count() == depth

    response = client.delete(
        f"/api/v1.0/documents/{documents[-1].id}/",
    )

    assert response.status_code == 204

    # Make sure it is only a soft delete
    assert models.Document.objects.count() == depth
    assert models.Document.objects.filter(deleted_at__isnull=True).count() == depth - 1
    assert models.Document.objects.filter(deleted_at__isnull=False).count() == 1


@pytest.mark.parametrize("via", VIA)
def test_api_documents_delete_authenticated_owner(via, mock_user_teams):
    """
    Authenticated users should be able to delete a document they own.
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

    response = client.delete(
        f"/api/v1.0/documents/{document.id}/",
    )

    assert response.status_code == 204

    # Make sure it is only a soft delete
    assert models.Document.objects.count() == 1
    assert models.Document.objects.filter(deleted_at__isnull=True).exists() is False
    assert models.Document.objects.filter(deleted_at__isnull=False).count() == 1
