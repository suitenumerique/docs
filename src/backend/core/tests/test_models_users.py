"""
Unit tests for the User model
"""

from django.core.exceptions import ValidationError

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
