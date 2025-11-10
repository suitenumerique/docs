"""Test mask document API endpoint for users in impress's core app."""

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
def test_api_document_mask_anonymous_user(method, reach):
    """Anonymous users should not be able to mask/unmask documents."""
    document = factories.DocumentFactory(link_reach=reach)

    response = getattr(APIClient(), method)(
        f"/api/v1.0/documents/{document.id!s}/mask/"
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }

    # Verify in database
    assert models.LinkTrace.objects.exists() is False


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
def test_api_document_mask_authenticated_post_allowed(reach, has_role):
    """Authenticated users should be able to mask a document to which they have access."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)
    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    # Try masking the document without a link trace
    response = client.post(f"/api/v1.0/documents/{document.id!s}/mask/")
    assert response.status_code == 400
    assert response.json() == {"detail": "User never accessed this document before."}
    assert not models.LinkTrace.objects.filter(document=document, user=user).exists()

    models.LinkTrace.objects.create(document=document, user=user)
    # Mask document
    response = client.post(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 201
    assert response.json() == {"detail": "Document was masked"}
    assert models.LinkTrace.objects.filter(
        document=document, user=user, is_masked=True
    ).exists()


def test_api_document_mask_authenticated_post_forbidden():
    """
    Authenticated users should no be allowed to mask a document
    to which they don't have access.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")

    # Try masking
    response = client.post(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    # Verify in database
    assert (
        models.LinkTrace.objects.filter(document=document, user=user).exists() is False
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
def test_api_document_mask_authenticated_post_already_masked_allowed(reach, has_role):
    """POST should not create duplicate link trace if already marked."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, masked_by=[user])
    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    # Try masking again
    response = client.post(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 200
    assert response.json() == {"detail": "Document was already masked"}
    assert models.LinkTrace.objects.filter(
        document=document, user=user, is_masked=True
    ).exists()


def test_api_document_mask_authenticated_post_already_masked_forbidden():
    """POST should not create duplicate masks if already marked."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted", masked_by=[user])
    # Try masking again
    response = client.post(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    assert models.LinkTrace.objects.filter(document=document, user=user).exists()


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
def test_api_document_mask_authenticated_post_unmasked_allowed(reach, has_role):
    """POST should not create duplicate link trace if unmasked."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)
    models.LinkTrace.objects.create(document=document, user=user, is_masked=False)
    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    # Try masking again
    response = client.post(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 201
    assert response.json() == {"detail": "Document was masked"}
    assert models.LinkTrace.objects.filter(
        document=document, user=user, is_masked=True
    ).exists()


def test_api_document_mask_authenticated_post_unmasked_forbidden():
    """POST should not create duplicate masks if unmasked."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    models.LinkTrace.objects.create(document=document, user=user, is_masked=False)
    # Try masking again
    response = client.post(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    assert models.LinkTrace.objects.filter(
        document=document, user=user, is_masked=False
    ).exists()


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
def test_api_document_mask_authenticated_delete_allowed(reach, has_role):
    """Authenticated users should be able to unmask a document using DELETE."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, masked_by=[user])
    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    # Unmask document
    response = client.delete(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 204
    assert response.content == b""  # No body
    assert response.text == ""  # Empty decoded text
    assert "Content-Type" not in response.headers  # No Content-Type for 204

    assert models.LinkTrace.objects.filter(
        document=document, user=user, is_masked=False
    ).exists()


def test_api_document_mask_authenticated_delete_forbidden():
    """
    Authenticated users should not be allowed to unmask a document if
    they don't have access to it.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted", masked_by=[user])

    # Unmask document
    response = client.delete(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    assert models.LinkTrace.objects.filter(
        document=document, user=user, is_masked=True
    ).exists()


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
def test_api_document_mask_authenticated_delete_not_masked_allowed(reach, has_role):
    """DELETE should be idempotent if the document is not masked."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)
    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)

    # Try unmasking the document without a link trace
    response = client.delete(f"/api/v1.0/documents/{document.id!s}/mask/")
    assert response.status_code == 400
    assert response.json() == {"detail": "User never accessed this document before."}
    assert not models.LinkTrace.objects.filter(document=document, user=user).exists()

    models.LinkTrace.objects.create(document=document, user=user, is_masked=False)
    # Unmask document
    response = client.delete(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 200
    assert response.json() == {"detail": "Document was already not masked"}
    assert models.LinkTrace.objects.filter(
        document=document, user=user, is_masked=False
    ).exists()


def test_api_document_mask_authenticated_delete_not_masked_forbidden():
    """DELETE should be idempotent if the document is not masked."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")

    # Try to unmask when no entry exists
    response = client.delete(f"/api/v1.0/documents/{document.id!s}/mask/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
    assert (
        models.LinkTrace.objects.filter(document=document, user=user).exists() is False
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
def test_api_document_mask_authenticated_post_unmark_then_mark_again_allowed(
    reach, has_role
):
    """A user should be able to mask, unmask, and mask a document again."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)
    if has_role:
        models.DocumentAccess.objects.create(document=document, user=user)
    models.LinkTrace.objects.create(document=document, user=user, is_masked=False)

    url = f"/api/v1.0/documents/{document.id!s}/mask/"

    # Mask document
    response = client.post(url)
    assert response.status_code == 201

    # Unmask document
    response = client.delete(url)
    assert response.status_code == 204
    assert response.content == b""  # No body
    assert response.text == ""  # Empty decoded text
    assert "Content-Type" not in response.headers  # No Content-Type for 204

    # Mask document again
    response = client.post(url)
    assert response.status_code == 201
    assert response.json() == {"detail": "Document was masked"}

    assert models.LinkTrace.objects.filter(
        document=document, user=user, is_masked=True
    ).exists()
