"""
Unit tests for the DocumentAskForAccess model: the pending requests that an access
granted another way than by accepting them makes obsolete are deleted.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.choices import RoleChoices

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "granted_role, requested_role",
    [
        (RoleChoices.OWNER, RoleChoices.READER),
        (RoleChoices.OWNER, RoleChoices.OWNER),
        (RoleChoices.EDITOR, RoleChoices.EDITOR),
        (RoleChoices.EDITOR, RoleChoices.COMMENTER),
        (RoleChoices.READER, RoleChoices.READER),
    ],
)
def test_models_document_ask_for_access_deleted_when_access_created(
    granted_role, requested_role
):
    """Being given the role requested, or a higher one, deletes the request."""
    request = factories.DocumentAskForAccessFactory(role=requested_role)

    models.DocumentAccess.objects.create(
        document=request.document, user=request.user, role=granted_role
    )

    assert not models.DocumentAskForAccess.objects.filter(id=request.id).exists()


@pytest.mark.parametrize(
    "granted_role, requested_role",
    [
        (RoleChoices.READER, RoleChoices.EDITOR),
        (RoleChoices.EDITOR, RoleChoices.ADMIN),
        (RoleChoices.ADMIN, RoleChoices.OWNER),
    ],
)
def test_models_document_ask_for_access_kept_when_access_lower(
    granted_role, requested_role
):
    """A role lower than the one requested leaves the request pending."""
    request = factories.DocumentAskForAccessFactory(role=requested_role)

    models.DocumentAccess.objects.create(
        document=request.document, user=request.user, role=granted_role
    )

    assert models.DocumentAskForAccess.objects.filter(id=request.id).exists()


def test_models_document_ask_for_access_deleted_when_access_raised():
    """Raising an existing access to the role requested deletes the request."""
    access = factories.UserDocumentAccessFactory(role=RoleChoices.READER)
    request = factories.DocumentAskForAccessFactory(
        document=access.document, user=access.user, role=RoleChoices.EDITOR
    )

    access.role = RoleChoices.OWNER
    access.save()

    assert not models.DocumentAskForAccess.objects.filter(id=request.id).exists()


def test_models_document_ask_for_access_other_requests_kept():
    """Only the request of the same user on the same document is deleted."""
    request = factories.DocumentAskForAccessFactory(role=RoleChoices.READER)
    other_user_request = factories.DocumentAskForAccessFactory(
        document=request.document, role=RoleChoices.READER
    )
    other_document_request = factories.DocumentAskForAccessFactory(
        user=request.user, role=RoleChoices.READER
    )

    models.DocumentAccess.objects.create(
        document=request.document, user=request.user, role=RoleChoices.OWNER
    )

    assert not models.DocumentAskForAccess.objects.filter(id=request.id).exists()
    assert (
        models.DocumentAskForAccess.objects.filter(
            id__in=[other_user_request.id, other_document_request.id]
        ).count()
        == 2
    )


def test_models_document_ask_for_access_team_access_keeps_requests():
    """An access given to a team names no user: no request is deleted."""
    request = factories.DocumentAskForAccessFactory(role=RoleChoices.READER)

    models.DocumentAccess.objects.create(
        document=request.document, team="lasuite", role=RoleChoices.OWNER
    )

    assert models.DocumentAskForAccess.objects.filter(id=request.id).exists()


def test_models_document_ask_for_access_deleted_when_added_through_the_api():
    """
    The case of the report: a user asks for access, an owner then adds them directly
    as owner. Their request is gone, an administrator can no longer accept it.
    """
    owner = factories.UserFactory()
    document = factories.DocumentFactory(users=[(owner, RoleChoices.OWNER)])
    request = factories.DocumentAskForAccessFactory(
        document=document, role=RoleChoices.READER
    )

    client = APIClient()
    client.force_login(owner)
    response = client.post(
        f"/api/v1.0/documents/{document.id}/accesses/",
        {"user_id": str(request.user_id), "role": RoleChoices.OWNER},
        format="json",
    )

    assert response.status_code == 201
    assert not models.DocumentAskForAccess.objects.filter(id=request.id).exists()


def test_models_document_ask_for_access_deleted_by_a_user_reconciliation():
    """
    A reconciliation moves the accesses of the inactive user to the active one in bulk,
    without saving them: the requests of the active user they cover are deleted too.
    """
    active_user = factories.UserFactory()
    inactive_user = factories.UserFactory()
    access = factories.UserDocumentAccessFactory(
        user=inactive_user, role=RoleChoices.OWNER
    )
    covered = factories.DocumentAskForAccessFactory(
        document=access.document, user=active_user, role=RoleChoices.EDITOR
    )
    other_document_request = factories.DocumentAskForAccessFactory(
        user=active_user, role=RoleChoices.EDITOR
    )

    reconciliation = models.UserReconciliation.objects.create(
        active_email=active_user.email,
        inactive_email=inactive_user.email,
        active_user=active_user,
        inactive_user=inactive_user,
        active_email_checked=True,
        inactive_email_checked=True,
        status="ready",
    )
    reconciliation.process_reconciliation_request()

    assert not models.DocumentAskForAccess.objects.filter(id=covered.id).exists()
    assert models.DocumentAskForAccess.objects.filter(
        id=other_document_request.id
    ).exists()
