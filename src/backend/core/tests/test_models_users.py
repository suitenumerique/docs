"""
Unit tests for the User model
"""

import uuid
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test.utils import override_settings

import pytest

from core import factories, models

pytestmark = pytest.mark.django_db


def test_models_users_str():
    """The str representation should be the email."""
    user = factories.UserFactory()
    assert str(user) == user.email


def test_models_users_id_unique():
    """The "id" field should be unique."""
    user = factories.UserFactory()
    with pytest.raises(ValidationError, match="User with this Id already exists."):
        factories.UserFactory(id=user.id)


@pytest.mark.parametrize(
    "sub,is_valid",
    [
        ("valid_sub.@+-:=/", True),
        ("invalid süb", False),
        (12345, True),
    ],
)
def test_models_users_sub_validator(sub, is_valid):
    """The "sub" field should be validated."""
    user = factories.UserFactory()
    user.sub = sub
    if is_valid:
        user.full_clean()
    else:
        with pytest.raises(
            ValidationError,
            match=("Enter a valid sub. This value should be ASCII only."),
        ):
            user.full_clean()


def test_modes_users_convert_valid_invitations():
    """
    The "convert_valid_invitations" method should convert valid invitations to document accesses.
    """
    email = "test@example.com"
    document = factories.DocumentFactory()
    other_document = factories.DocumentFactory()
    invitation_document = factories.InvitationFactory(email=email, document=document)
    invitation_other_document = factories.InvitationFactory(
        email="Test@example.coM", document=other_document
    )
    other_email_invitation = factories.InvitationFactory(
        email="pre_test@example.com", document=document
    )

    assert document.accesses.count() == 0
    assert other_document.accesses.count() == 0

    user = factories.UserFactory(email=email)

    assert document.accesses.filter(user=user).count() == 1
    assert other_document.accesses.filter(user=user).count() == 1

    assert not models.Invitation.objects.filter(id=invitation_document.id).exists()
    assert not models.Invitation.objects.filter(
        id=invitation_other_document.id
    ).exists()
    assert models.Invitation.objects.filter(id=other_email_invitation.id).exists()


@override_settings(USER_ONBOARDING_DOCUMENTS=[])
def test_models_users_handle_onboarding_documents_access_empty_setting():
    """
    When USER_ONBOARDING_DOCUMENTS is empty, no accesses should be created.
    """
    user = factories.UserFactory()
    assert models.DocumentAccess.objects.filter(user=user).count() == 0


def test_models_users_handle_onboarding_documents_access_with_single_document():
    """
    When USER_ONBOARDING_DOCUMENTS has a valid document ID,
    an access should be created for the new user with the READER role.

    The document should be pinned as a favorite for the user.
    """
    document = factories.DocumentFactory()

    with override_settings(USER_ONBOARDING_DOCUMENTS=[str(document.id)]):
        user = factories.UserFactory()

    assert (
        models.DocumentAccess.objects.filter(user=user, document=document).count() == 1
    )

    access = models.DocumentAccess.objects.get(user=user, document=document)
    assert access.role == models.RoleChoices.READER

    user_favorites = models.DocumentFavorite.objects.filter(user=user)
    assert user_favorites.count() == 1
    assert user_favorites.filter(document=document).exists()


def test_models_users_handle_onboarding_documents_access_with_multiple_documents():
    """
    When USER_ONBOARDING_DOCUMENTS has multiple valid document IDs,
    accesses should be created for all documents.

    All accesses should have the READER role.
    All documents should be pinned as favorites for the user.
    """
    document1 = factories.DocumentFactory(title="Document 1")
    document2 = factories.DocumentFactory(title="Document 2")
    document3 = factories.DocumentFactory(title="Document 3")

    with override_settings(
        USER_ONBOARDING_DOCUMENTS=[
            str(document1.id),
            str(document2.id),
            str(document3.id),
        ]
    ):
        user = factories.UserFactory()

    user_accesses = models.DocumentAccess.objects.filter(user=user)
    assert user_accesses.count() == 3

    assert models.DocumentAccess.objects.filter(user=user, document=document1).exists()
    assert models.DocumentAccess.objects.filter(user=user, document=document2).exists()
    assert models.DocumentAccess.objects.filter(user=user, document=document3).exists()

    for access in user_accesses:
        assert access.role == models.RoleChoices.READER

    user_favorites = models.DocumentFavorite.objects.filter(user=user)
    assert user_favorites.count() == 3
    assert user_favorites.filter(document=document1).exists()
    assert user_favorites.filter(document=document2).exists()
    assert user_favorites.filter(document=document3).exists()


def test_models_users_handle_onboarding_documents_access_with_invalid_document_id():
    """
    When USER_ONBOARDING_DOCUMENTS has an invalid document ID,
    it should be skipped and logged, but not raise an exception.
    """
    invalid_id = uuid.uuid4()

    with override_settings(USER_ONBOARDING_DOCUMENTS=[str(invalid_id)]):
        with patch("core.models.logger") as mock_logger:
            user = factories.UserFactory()

            mock_logger.warning.assert_called_once()
            call_args = mock_logger.warning.call_args
            assert "Onboarding document with id" in call_args[0][0]

    assert models.DocumentAccess.objects.filter(user=user).count() == 0


def test_models_users_handle_onboarding_documents_access_duplicate_prevention():
    """
    If the same document is listed multiple times in USER_ONBOARDING_DOCUMENTS,
    it should only create one access (or handle duplicates gracefully).
    """
    document = factories.DocumentFactory()

    with override_settings(
        USER_ONBOARDING_DOCUMENTS=[str(document.id), str(document.id)]
    ):
        user = factories.UserFactory()

    user_accesses = models.DocumentAccess.objects.filter(user=user, document=document)

    assert user_accesses.count() >= 1


@override_settings(USER_ONBOARDING_SANDBOX_DOCUMENT=None)
def test_models_users_duplicate_onboarding_sandbox_document_no_setting():
    """
    When USER_ONBOARDING_SANDBOX_DOCUMENT is not set, no sandbox document should be created.
    """
    user = factories.UserFactory()

    assert (
        models.Document.objects.filter(creator=user, title__icontains="Sandbox").count()
        == 0
    )

    initial_accesses = models.DocumentAccess.objects.filter(user=user).count()
    assert initial_accesses == 0


def test_models_users_duplicate_onboarding_sandbox_document_creates_sandbox():
    """
    When USER_ONBOARDING_SANDBOX_DOCUMENT is set with a valid template document,
    a new sandbox document should be created for the user with OWNER access.
    """
    template_document = factories.DocumentFactory(title="Getting started with Docs")

    with override_settings(USER_ONBOARDING_SANDBOX_DOCUMENT=str(template_document.id)):
        user = factories.UserFactory()

    sandbox_docs = models.Document.objects.filter(
        creator=user, title="Getting started with Docs"
    )
    assert sandbox_docs.count() == 1

    sandbox_doc = sandbox_docs.first()
    assert sandbox_doc.creator == user
    assert sandbox_doc.duplicated_from == template_document

    access = models.DocumentAccess.objects.get(user=user, document=sandbox_doc)
    assert access.role == models.RoleChoices.OWNER


def test_models_users_duplicate_onboarding_sandbox_document_with_invalid_template_id():
    """
    When USER_ONBOARDING_SANDBOX_DOCUMENT has an invalid document ID,
    it should be skipped and logged, but not raise an exception.
    """
    invalid_id = uuid.uuid4()

    with override_settings(USER_ONBOARDING_SANDBOX_DOCUMENT=str(invalid_id)):
        with patch("core.models.logger") as mock_logger:
            user = factories.UserFactory()

            mock_logger.warning.assert_called_once()
            call_args = mock_logger.warning.call_args
            assert "Onboarding sandbox document with id" in call_args[0][0]

    sandbox_docs = models.Document.objects.filter(creator=user)
    assert sandbox_docs.count() == 0


def test_models_users_duplicate_onboarding_sandbox_document_creates_unique_sandbox_per_user():
    """
    Each new user should get their own independent sandbox document.
    """
    template_document = factories.DocumentFactory(title="Getting started with Docs")

    with override_settings(USER_ONBOARDING_SANDBOX_DOCUMENT=str(template_document.id)):
        user1 = factories.UserFactory()
        user2 = factories.UserFactory()

    sandbox_docs_user1 = models.Document.objects.filter(
        creator=user1, title="Getting started with Docs"
    )
    sandbox_docs_user2 = models.Document.objects.filter(
        creator=user2, title="Getting started with Docs"
    )

    assert sandbox_docs_user1.count() == 1
    assert sandbox_docs_user2.count() == 1

    assert sandbox_docs_user1.first().id != sandbox_docs_user2.first().id


def test_models_users_duplicate_onboarding_sandbox_document_integration_with_other_methods():
    """
    Verify that sandbox creation works alongside other onboarding methods.
    """
    template_document = factories.DocumentFactory(title="Getting started with Docs")
    onboarding_doc = factories.DocumentFactory(title="Onboarding Document")

    with override_settings(
        USER_ONBOARDING_SANDBOX_DOCUMENT=str(template_document.id),
        USER_ONBOARDING_DOCUMENTS=[str(onboarding_doc.id)],
    ):
        user = factories.UserFactory()

    sandbox_doc = models.Document.objects.filter(
        creator=user, title="Getting started with Docs"
    ).first()

    user_accesses = models.DocumentAccess.objects.filter(user=user)
    assert user_accesses.count() == 2

    sandbox_access = user_accesses.get(document=sandbox_doc)
    onboarding_access = user_accesses.get(document=onboarding_doc)

    assert sandbox_access.role == models.RoleChoices.OWNER
    assert onboarding_access.role == models.RoleChoices.READER
