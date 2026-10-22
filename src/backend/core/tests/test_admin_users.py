"""Tests for the user admin class."""

from datetime import timedelta
from unittest import mock

from django.contrib import admin
from django.test import RequestFactory
from django.utils import timezone

import pytest

from core import factories, models
from core.admin import UserAdmin

pytestmark = pytest.mark.django_db


def _admin_client(client):
    """Log a superuser in the client."""
    client.force_login(factories.UserFactory(is_staff=True, is_superuser=True))
    return client


def test_admin_users_duplicate_email_filter(client):
    """The filter should keep the users sharing their email, case ignored."""
    first = factories.UserFactory(email="john.doe@example.com")
    second = factories.UserFactory(email="JOHN.DOE@example.com")
    factories.UserFactory(email="jane.doe@example.com")
    factories.UserFactory(email=None)

    response = _admin_client(client).get("/admin/core/user/?duplicate_email=yes")

    assert response.status_code == 200
    assert {user.pk for user in response.context["cl"].result_list} == {
        first.pk,
        second.pk,
    }


def test_admin_users_deactivate_duplicates():
    """The action should keep the most recently used user of each email."""
    now = timezone.now()
    kept = [
        factories.UserFactory(
            email="john.doe@example.com", last_login=now + timedelta(days=1)
        ),
        factories.UserFactory(email="jane.doe@example.com", last_login=None),
        factories.UserFactory(email="single@example.com", last_login=None),
        factories.UserFactory(email=None, last_login=None),
        factories.UserFactory(email=None, last_login=None),
    ]
    deactivated = [
        factories.UserFactory(email="JOHN.DOE@example.com", last_login=now),
        factories.UserFactory(email="john.doe@example.com", last_login=None),
        factories.UserFactory(email="jane.doe@example.com", last_login=now),
    ]
    # Without last login, the creation date counts
    kept[1].created_at = now + timedelta(days=1)
    kept[1].save()
    request = RequestFactory().post("/")

    with mock.patch.object(UserAdmin, "message_user") as message_user:
        admin.site.get_model_admin(models.User).deactivate_duplicates(
            request, models.User.objects.all()
        )

    assert set(models.User.objects.filter(is_active=True)) == set(kept)
    assert set(models.User.objects.filter(is_active=False)) == set(deactivated)
    message_user.assert_called_once_with(request, "3 users deactivated.")


def test_admin_users_deactivate_duplicates_keeps_an_active_user():
    """The action should keep an active user rather than a more recent inactive one."""
    now = timezone.now()
    active = factories.UserFactory(email="john.doe@example.com", last_login=now)
    factories.UserFactory(
        email="john.doe@example.com",
        last_login=now + timedelta(days=1),
        is_active=False,
    )
    request = RequestFactory().post("/")

    with mock.patch.object(UserAdmin, "message_user") as message_user:
        admin.site.get_model_admin(models.User).deactivate_duplicates(
            request, models.User.objects.all()
        )

    assert list(models.User.objects.filter(is_active=True)) == [active]
    message_user.assert_called_once_with(request, "1 users deactivated.")
