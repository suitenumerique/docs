"""Module testing migration 0030 about adding is_first_connection to user model."""

from django.contrib.auth.hashers import make_password

import factory
import pytest

from core import models


@pytest.mark.django_db
def test_set_is_first_connection_false(migrator):
    """
    Test that once the migration adding is_first_connection column to user model is applied
    all existing user have the False value.
    """
    old_state = migrator.apply_initial_migration(
        ("core", "0029_userreconciliationcsvimport_userreconciliation")
    )
    OldUser = old_state.apps.get_model("core", "User")

    old_user1 = OldUser.objects.create(
        email="email1@example.com", sub="user1", password=make_password("password")
    )
    old_user2 = OldUser.objects.create(
        email="email2@example.com", sub="user2", password=make_password("password")
    )

    assert hasattr(old_user1, "is_first_connection") is False
    assert hasattr(old_user2, "is_first_connection") is False

    # # Apply the migration
    new_state = migrator.apply_tested_migration(
        ("core", "0030_user_is_first_connection")
    )

    NewUser = new_state.apps.get_model("core", "User")

    updated_user1 = NewUser.objects.get(id=old_user1.id)

    assert updated_user1.is_first_connection is False

    updated_user2 = NewUser.objects.get(id=old_user2.id)

    assert updated_user2.is_first_connection is False

    # create a new user after migration

    new_user1 = NewUser.objects.create(
        email="email3example.com", sub="user3", password=make_password("password")
    )
    assert new_user1.is_first_connection is True
