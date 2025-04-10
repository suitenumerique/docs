"""
Test config API endpoints in the Impress core app.
"""

from django.test import override_settings

import pytest
from rest_framework.status import (
    HTTP_200_OK,
)
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


@override_settings(
    COLLABORATION_WS_URL="http://testcollab/",
    CRISP_WEBSITE_ID="123",
    FRONTEND_CSS_URL="http://testcss/",
    FRONTEND_HOMEPAGE_FEATURE_ENABLED=True,
    FRONTEND_FOOTER_FEATURE_ENABLED=True,
    FRONTEND_THEME="test-theme",
    MEDIA_BASE_URL="http://testserver/",
    POSTHOG_KEY={"id": "132456", "host": "https://eu.i.posthog-test.com"},
    SENTRY_DSN="https://sentry.test/123",
)
@pytest.mark.parametrize("is_authenticated", [False, True])
def test_api_config(is_authenticated):
    """Anonymous users should be allowed to get the configuration."""
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory()
        client.force_login(user)

    response = client.get("/api/v1.0/config/")
    assert response.status_code == HTTP_200_OK
    assert response.json() == {
        "COLLABORATION_WS_URL": "http://testcollab/",
        "CRISP_WEBSITE_ID": "123",
        "ENVIRONMENT": "test",
        "FRONTEND_CSS_URL": "http://testcss/",
        "FRONTEND_HOMEPAGE_FEATURE_ENABLED": True,
        "FRONTEND_FOOTER_FEATURE_ENABLED": True,
        "FRONTEND_THEME": "test-theme",
        "LANGUAGES": [
            ["en-us", "English"],
            ["fr-fr", "Français"],
            ["de-de", "Deutsch"],
            ["nl-nl", "Nederlands"],
        ],
        "LANGUAGE_CODE": "en-us",
        "MEDIA_BASE_URL": "http://testserver/",
        "POSTHOG_KEY": {"id": "132456", "host": "https://eu.i.posthog-test.com"},
        "SENTRY_DSN": "https://sentry.test/123",
        "AI_FEATURE_ENABLED": False,
    }
