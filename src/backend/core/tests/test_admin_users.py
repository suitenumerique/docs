"""Tests for the user admin class."""

import pytest

from core import factories

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
