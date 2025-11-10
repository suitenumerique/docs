"""Test favorite document API endpoint for users in impress's core app."""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "reach",
    [
        "restricted",
        "authenticated",
        "public",
    ],
)
@pytest.mark.parametrize("method", ["post", "delete"])
def test_api_document_favorite_anonymous_user(method, reach):
    """Anonymous users should not be able to mark/unmark documents as favorites."""
    document = factories.DocumentFactory(link_reach=reach)

    response = getattr(APIClient(), method)(
        f"/api/v1.0/documents/{document.id!s}/favorite/"
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }

    # Verify in database
    assert models.DocumentFavorite.objects.exists() is False


@pytest.mark.parametrize(
    "reach, has_role",
    [
        ["restricted", True],
        ["authenticated", False],
        ["authenticated", True],
        ["public", False],
        ["public", True],
    ],
)
def test_api_document_favorite_authenticated_post_allowed(reach, has_role):
    """
    Authenticated users should be able to mark a document to which they have access
    as favorite using POST.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach=reach)
    client = APIClient()
    client.force_login(user)

    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    # Mark as favorite
    response = client.post(f"/api/v1.0/documents/{document.id!s}/favorite/")

    assert response.status_code == 201
    assert response.json() == {"detail": "Document marked as favorite"}

    # Verify in database
    assert models.DocumentFavorite.objects.filter(document=document, user=user).exists()

    # Verify document format
    response = client.get(f"/api/v1.0/documents/{document.id!s}/")
    assert response.json()["is_favorite"] is True


def test_api_document_favorite_authenticated_post_forbidden():
    """
    Authenticated users should not be allowed to mark a document to which they don't
    have access as favorite using POST.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    client = APIClient()
    client.force_login(user)

    # Try marking as favorite
    response = client.post(f"/api/v1.0/documents/{document.id!s}/favorite/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    # Verify in database
    assert (
        models.DocumentFavorite.objects.filter(document=document, user=user).exists()
        is False
    )


@pytest.mark.parametrize(
    "reach, has_role",
    [
        ["restricted", True],
        ["authenticated", False],
        ["authenticated", True],
        ["public", False],
        ["public", True],
    ],
)
def test_api_document_favorite_authenticated_post_already_favorited_allowed(
    reach, has_role
):
    """POST should not create duplicate favorites if already marked."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach=reach, favorited_by=[user])
    client = APIClient()
    client.force_login(user)

    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    # Try to mark as favorite again
    response = client.post(f"/api/v1.0/documents/{document.id!s}/favorite/")

    assert response.status_code == 200
    assert response.json() == {"detail": "Document already marked as favorite"}

    # Verify in database
    assert models.DocumentFavorite.objects.filter(document=document, user=user).exists()

    # Verify document format
    response = client.get(f"/api/v1.0/documents/{document.id!s}/")
    assert response.json()["is_favorite"] is True


def test_api_document_favorite_authenticated_post_already_favorited_forbidden():
    """POST should not create duplicate favorites if already marked."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted", favorited_by=[user])
    client = APIClient()
    client.force_login(user)

    # Try to mark as favorite again
    response = client.post(f"/api/v1.0/documents/{document.id!s}/favorite/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    # Verify in database
    assert models.DocumentFavorite.objects.filter(document=document, user=user).exists()


@pytest.mark.parametrize(
    "reach, has_role",
    [
        ["restricted", True],
        ["authenticated", False],
        ["authenticated", True],
        ["public", False],
        ["public", True],
    ],
)
def test_api_document_favorite_authenticated_delete_allowed(reach, has_role):
    """Authenticated users should be able to unmark a document as favorite using DELETE."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach=reach, favorited_by=[user])
    client = APIClient()
    client.force_login(user)

    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    # Unmark as favorite
    response = client.delete(f"/api/v1.0/documents/{document.id!s}/favorite/")
    assert response.status_code == 204

    # Verify in database
    assert (
        models.DocumentFavorite.objects.filter(document=document, user=user).exists()
        is False
    )

    # Verify document format
    response = client.get(f"/api/v1.0/documents/{document.id!s}/")
    assert response.json()["is_favorite"] is False


def test_api_document_favorite_authenticated_delete_forbidden():
    """Authenticated users should be able to unmark a document as favorite using DELETE."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted", favorited_by=[user])
    client = APIClient()
    client.force_login(user)

    # Unmark as favorite
    response = client.delete(f"/api/v1.0/documents/{document.id!s}/favorite/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    # Verify in database
    assert (
        models.DocumentFavorite.objects.filter(document=document, user=user).exists()
        is True
    )


@pytest.mark.parametrize(
    "reach, has_role",
    [
        ["restricted", True],
        ["authenticated", False],
        ["authenticated", True],
        ["public", False],
        ["public", True],
    ],
)
def test_api_document_favorite_authenticated_delete_not_favorited_allowed(
    reach, has_role
):
    """DELETE should be idempotent if the document is not marked as favorite."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach=reach)
    client = APIClient()
    client.force_login(user)

    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    # Try to unmark as favorite when no favorite entry exists
    response = client.delete(f"/api/v1.0/documents/{document.id!s}/favorite/")

    assert response.status_code == 200
    assert response.json() == {"detail": "Document was already not marked as favorite"}

    # Verify in database
    assert (
        models.DocumentFavorite.objects.filter(document=document, user=user).exists()
        is False
    )

    # Verify document format
    response = client.get(f"/api/v1.0/documents/{document.id!s}/")
    assert response.json()["is_favorite"] is False


def test_api_document_favorite_authenticated_delete_not_favorited_forbidden():
    """DELETE should be idempotent if the document is not marked as favorite."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    client = APIClient()
    client.force_login(user)

    # Try to unmark as favorite when no favorite entry exists
    response = client.delete(f"/api/v1.0/documents/{document.id!s}/favorite/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    # Verify in database
    assert (
        models.DocumentFavorite.objects.filter(document=document, user=user).exists()
        is False
    )


@pytest.mark.parametrize(
    "reach, has_role",
    [
        ["restricted", True],
        ["authenticated", False],
        ["authenticated", True],
        ["public", False],
        ["public", True],
    ],
)
def test_api_document_favorite_authenticated_post_unmark_then_mark_again_allowed(
    reach, has_role
):
    """A user should be able to mark, unmark, and mark a document again as favorite."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach=reach)
    client = APIClient()
    client.force_login(user)

    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    url = f"/api/v1.0/documents/{document.id!s}/favorite/"

    # Mark as favorite
    response = client.post(url)
    assert response.status_code == 201

    # Unmark as favorite
    response = client.delete(url)
    assert response.status_code == 204

    # Mark as favorite again
    response = client.post(url)
    assert response.status_code == 201
    assert response.json() == {"detail": "Document marked as favorite"}

    # Verify in database
    assert models.DocumentFavorite.objects.filter(document=document, user=user).exists()

    # Verify document format
    response = client.get(f"/api/v1.0/documents/{document.id!s}/")
    assert response.json()["is_favorite"] is True
