"""
Tests for Templates API endpoint in impress's core app: create
"""

import pytest
from rest_framework.test import APIClient

from core import factories
from core.models import Template

pytestmark = pytest.mark.django_db


def test_api_templates_create_anonymous():
    """Anonymous users should not be allowed to create templates."""
    response = APIClient().post(
        "/api/v1.0/templates/",
        {
            "title": "my template",
        },
    )

    assert response.status_code == 401
    assert not Template.objects.exists()


def test_api_templates_create_authenticated():
    """
    Authenticated users should be able to create templates and should automatically be declared
    as the owner of the newly created template.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    response = client.post(
        "/api/v1.0/templates/",
        {
            "title": "my template",
        },
        format="json",
    )

    assert response.status_code == 405
    assert not Template.objects.exists()
