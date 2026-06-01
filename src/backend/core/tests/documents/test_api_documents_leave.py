"""Test for the leave document API"""

from unittest import mock

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core import factories, models
from core.utils.analytics import PosthogEventName

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "link_reach",
    models.LinkReachChoices.values,
)
def test_api_documents_leave_document_anonymous_user(link_reach):
    """
    Anonymous user are not allowed to access the leave feature no matter the document link reach.
    """

    document = factories.DocumentFactory(link_reach=link_reach)

    client = APIClient()
    response = client.post(f"/api/v1.0/documents/{document.id!s}/leave/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.parametrize(
    "link_reach",
    models.LinkReachChoices.values,
)
def test_api_documents_leave_connected_user_without_access_nor_link_trace(link_reach):
    """
    A connected user with no access or link_trace on the document can not access the leave feature
    """

    user = factories.UserFactory()
    other_users = factories.UserFactory.create_batch(3)

    document = factories.DocumentFactory(link_reach=link_reach, link_traces=other_users)

    factories.UserDocumentAccessFactory.create_batch(4, document=document)

    assert not models.LinkTrace.objects.filter(document=document, user=user).exists()
    assert not models.DocumentAccess.objects.filter(
        document=document, user=user
    ).exists()

    assert models.LinkTrace.objects.count() == 3
    assert models.DocumentAccess.objects.count() == 4

    client = APIClient()
    client.force_login(user)
    response = client.post(f"/api/v1.0/documents/{document.id!s}/leave/")

    assert response.status_code == status.HTTP_403_FORBIDDEN

    assert models.LinkTrace.objects.count() == 3
    assert models.DocumentAccess.objects.count() == 4


@pytest.mark.parametrize(
    "link_reach",
    [models.LinkReachChoices.PUBLIC, models.LinkReachChoices.AUTHENTICATED],
)
def test_api_documents_leave_connected_user_with_link_trace(link_reach):
    """
    A connected user with link_trace on a document can leave it.
    """

    user = factories.UserFactory()
    other_users = factories.UserFactory.create_batch(3)

    document = factories.DocumentFactory(
        link_reach=link_reach, link_traces=[user, *other_users]
    )
    factories.UserDocumentAccessFactory.create_batch(4, document=document)

    assert models.LinkTrace.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.count() == 4
    assert models.DocumentAccess.objects.count() == 4

    client = APIClient()
    client.force_login(user)
    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(f"/api/v1.0/documents/{document.id!s}/leave/")

    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Leaving the document should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_LEFT,
        user,
        {},
        document=document,
    )

    assert not models.LinkTrace.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.count() == 3
    assert models.DocumentAccess.objects.count() == 4


@pytest.mark.parametrize(
    "link_reach",
    models.LinkReachChoices.values,
)
@pytest.mark.parametrize(
    "role", [role for role in models.RoleChoices if role not in models.PRIVILEGED_ROLES]
)
def test_api_documents_leave_connected_user_with_access(role, link_reach):
    """Connected user with a DocumentAccess can leave it."""

    user = factories.UserFactory()
    other_users = factories.UserFactory.create_batch(3)

    document = factories.DocumentFactory(
        link_reach=link_reach, link_traces=other_users, users=[(user, role)]
    )
    factories.UserDocumentAccessFactory.create_batch(4, document=document)

    assert models.DocumentAccess.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.count() == 3
    assert models.DocumentAccess.objects.count() == 5

    client = APIClient()
    client.force_login(user)
    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(f"/api/v1.0/documents/{document.id!s}/leave/")

    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Leaving the document should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_LEFT,
        user,
        {},
        document=document,
    )

    assert not models.DocumentAccess.objects.filter(
        document=document, user=user
    ).exists()
    assert models.LinkTrace.objects.count() == 3
    assert models.DocumentAccess.objects.count() == 4


@pytest.mark.parametrize(
    "link_reach",
    models.LinkReachChoices.values,
)
@pytest.mark.parametrize(
    "role", [role for role in models.RoleChoices if role in models.PRIVILEGED_ROLES]
)
def test_api_documents_leave_connected_access_with_privileged_role_not_allowed(
    role, link_reach
):
    """Connected user with privileged access role can not leave a document."""

    user = factories.UserFactory()
    other_users = factories.UserFactory.create_batch(3)

    document = factories.DocumentFactory(
        link_reach=link_reach, link_traces=[user, *other_users], users=[(user, role)]
    )
    factories.UserDocumentAccessFactory.create_batch(4, document=document)

    assert models.DocumentAccess.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.count() == 4
    assert models.DocumentAccess.objects.count() == 5

    client = APIClient()
    client.force_login(user)
    response = client.post(f"/api/v1.0/documents/{document.id!s}/leave/")

    assert response.status_code == status.HTTP_403_FORBIDDEN

    assert models.DocumentAccess.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.count() == 4
    assert models.DocumentAccess.objects.count() == 5


@pytest.mark.parametrize(
    "link_reach",
    models.LinkReachChoices.values,
)
@pytest.mark.parametrize(
    "role", [role for role in models.RoleChoices if role not in models.PRIVILEGED_ROLES]
)
def test_api_documents_leave_connected_user_with_access_and_link_trace(
    role, link_reach
):
    """Connected user with a DocumentAccess can leave it."""

    user = factories.UserFactory()
    other_users = factories.UserFactory.create_batch(3)

    document = factories.DocumentFactory(
        link_reach=link_reach, link_traces=[user, *other_users], users=[(user, role)]
    )
    factories.UserDocumentAccessFactory.create_batch(4, document=document)

    assert models.DocumentAccess.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.count() == 4
    assert models.DocumentAccess.objects.count() == 5

    client = APIClient()
    client.force_login(user)
    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(f"/api/v1.0/documents/{document.id!s}/leave/")

    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Leaving the document should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_LEFT,
        user,
        {},
        document=document,
    )

    assert not models.DocumentAccess.objects.filter(
        document=document, user=user
    ).exists()
    assert not models.LinkTrace.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.count() == 3
    assert models.DocumentAccess.objects.count() == 4


@pytest.mark.parametrize(
    "link_reach",
    models.LinkReachChoices.values,
)
@pytest.mark.parametrize(
    "role", [role for role in models.RoleChoices if role not in models.PRIVILEGED_ROLES]
)
def test_api_documents_leave_connected_accessing_multiple_documents_leave_only_one(
    role, link_reach
):
    """Connected user accessing multiple document leaving one should keep access to the others."""

    user = factories.UserFactory()
    other_users = factories.UserFactory.create_batch(3)

    document = factories.DocumentFactory(
        link_reach=link_reach, link_traces=[user, *other_users], users=[(user, role)]
    )
    factories.UserDocumentAccessFactory.create_batch(4, document=document)

    # Create access to other documents for the same user
    factories.UserDocumentAccessFactory.create_batch(4, user=user)

    assert models.DocumentAccess.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.count() == 4
    assert models.DocumentAccess.objects.count() == 9

    client = APIClient()
    client.force_login(user)
    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(f"/api/v1.0/documents/{document.id!s}/leave/")

    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Leaving the document should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_LEFT,
        user,
        {},
        document=document,
    )

    assert not models.DocumentAccess.objects.filter(
        document=document, user=user
    ).exists()
    assert not models.LinkTrace.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.count() == 3
    assert models.DocumentAccess.objects.count() == 8


@pytest.mark.parametrize(
    "link_reach",
    models.LinkReachChoices.values,
)
@pytest.mark.parametrize(
    "role", [role for role in models.RoleChoices if role not in models.PRIVILEGED_ROLES]
)
def test_api_documents_leave_connected_leave_also_sub_documents(role, link_reach):
    """User connected with access and link_trace to a tree should leave all the tree."""

    user = factories.UserFactory()
    other_users = factories.UserFactory.create_batch(3)

    document = factories.DocumentFactory(
        link_reach=link_reach, link_traces=[user, *other_users], users=[(user, role)]
    )
    child = factories.DocumentFactory(parent=document, link_traces=[user, *other_users])
    grand_child = factories.DocumentFactory(
        parent=child, link_traces=[user, *other_users], users=[(user, role)]
    )

    factories.UserDocumentAccessFactory.create_batch(4, document=document)

    # Create access to other documents for the same user
    factories.UserDocumentAccessFactory.create_batch(4, user=user)

    assert models.DocumentAccess.objects.filter(document=document, user=user).exists()
    assert models.DocumentAccess.objects.filter(
        document=grand_child, user=user
    ).exists()
    assert models.LinkTrace.objects.filter(document=document, user=user).exists()
    assert models.LinkTrace.objects.filter(document=child, user=user).exists()
    assert models.LinkTrace.objects.filter(document=grand_child, user=user).exists()
    assert models.LinkTrace.objects.count() == 12
    assert models.DocumentAccess.objects.count() == 10

    client = APIClient()
    client.force_login(user)
    with mock.patch("core.api.viewsets.posthog_capture") as mock_capture:
        response = client.post(f"/api/v1.0/documents/{document.id!s}/leave/")

    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Leaving the document should be tracked in PostHog
    mock_capture.assert_called_once_with(
        PosthogEventName.DOC_LEFT,
        user,
        {},
        document=document,
    )

    assert not models.DocumentAccess.objects.filter(
        document=document, user=user
    ).exists()
    assert not models.DocumentAccess.objects.filter(
        document=grand_child, user=user
    ).exists()
    assert not models.LinkTrace.objects.filter(document=document, user=user).exists()
    assert not models.LinkTrace.objects.filter(document=child, user=user).exists()
    assert not models.LinkTrace.objects.filter(document=grand_child, user=user).exists()
    assert models.LinkTrace.objects.count() == 9
    assert models.DocumentAccess.objects.count() == 8
