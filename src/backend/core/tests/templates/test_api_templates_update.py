"""
Tests for Templates API endpoint in impress's core app: update
"""

import pytest
from rest_framework.test import APIClient

from core import factories
from core.api import serializers

pytestmark = pytest.mark.django_db


def test_api_templates_update_anonymous():
    """Anonymous users should not be allowed to update a template."""
    template = factories.TemplateFactory()

    new_template_values = serializers.TemplateSerializer(
        instance=factories.TemplateFactory()
    ).data
    response = APIClient().put(
        f"/api/v1.0/templates/{template.id!s}/",
        new_template_values,
        format="json",
    )
    assert response.status_code == 401


def test_api_templates_update_not_implemented():
    """
    Authenticated users should not be allowed to update a template.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    template = factories.TemplateFactory(users=[(user, "owner")])

    new_template_values = serializers.TemplateSerializer(
        instance=factories.TemplateFactory()
    ).data

    response = client.put(
        f"/api/v1.0/templates/{template.id!s}/", new_template_values, format="json"
    )

    assert response.status_code == 405

    response = client.patch(
        f"/api/v1.0/templates/{template.id!s}/", new_template_values, format="json"
    )

    assert response.status_code == 405
