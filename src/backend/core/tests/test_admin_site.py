"""Tests for the admin site."""

from django.conf import settings

import pytest

from core import factories

pytestmark = pytest.mark.django_db


def test_admin_site_header_shows_the_release(client):
    """The admin header should show the release read from pyproject.toml."""
    client.force_login(factories.UserFactory(is_staff=True, is_superuser=True))

    response = client.get("/admin/")

    assert settings.RELEASE != "NA"
    assert f" {settings.RELEASE}</a></div>" in response.content.decode()
