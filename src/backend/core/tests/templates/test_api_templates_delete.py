"""
Tests for Templates API endpoint in impress's core app: delete
"""

import random

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_api_templates_delete_anonymous():
    """Anonymous users should not be allowed to destroy a template."""
    template = factories.TemplateFactory()

    response = APIClient().delete(
        f"/api/v1.0/templates/{template.id!s}/",
    )

    assert response.status_code == 401
    assert models.Template.objects.count() == 1


def test_api_templates_delete_not_implemented():
    """
    Authenticated users should not be allowed to delete a template to which they are not
    related.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    is_public = random.choice([True, False])
    template = factories.TemplateFactory(is_public=is_public, users=[(user, "owner")])

    response = client.delete(
        f"/api/v1.0/templates/{template.id!s}/",
    )

    assert response.status_code == 405
    assert models.Template.objects.count() == 1
