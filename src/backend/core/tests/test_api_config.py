"""
Test config API endpoints in the Impress core app.
"""

import json

from django.test import override_settings

import pytest
from rest_framework.status import (
    HTTP_200_OK,
)
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


@override_settings(
    AI_FEATURE_ENABLED=False,
    COLLABORATION_WS_URL="http://testcollab/",
    COLLABORATION_WS_NOT_CONNECTED_READY_ONLY=True,
    CRISP_WEBSITE_ID="123",
    FRONTEND_CSS_URL="http://testcss/",
    FRONTEND_THEME="test-theme",
    MEDIA_BASE_URL="http://testserver/",
    POSTHOG_KEY={"id": "132456", "host": "https://eu.i.posthog-test.com"},
    SENTRY_DSN="https://sentry.test/123",
    THEME_CUSTOMIZATION_FILE_PATH="",
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
        "COLLABORATION_WS_NOT_CONNECTED_READY_ONLY": True,
        "CRISP_WEBSITE_ID": "123",
        "ENVIRONMENT": "test",
        "FRONTEND_CSS_URL": "http://testcss/",
        "FRONTEND_HOMEPAGE_FEATURE_ENABLED": True,
        "FRONTEND_THEME": "test-theme",
        "LANGUAGES": [
            ["en-us", "English"],
            ["fr-fr", "Français"],
            ["de-de", "Deutsch"],
            ["nl-nl", "Nederlands"],
            ["es-es", "Español"],
        ],
        "LANGUAGE_CODE": "en-us",
        "MEDIA_BASE_URL": "http://testserver/",
        "POSTHOG_KEY": {"id": "132456", "host": "https://eu.i.posthog-test.com"},
        "SENTRY_DSN": "https://sentry.test/123",
        "AI_FEATURE_ENABLED": False,
        "theme_customization": {},
    }
    policy_list = sorted(response.headers["Content-Security-Policy"].split("; "))
    assert policy_list == [
        "base-uri 'none'",
        "child-src 'none'",
        "connect-src 'none'",
        "default-src 'none'",
        "font-src 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "frame-src 'none'",
        "img-src 'none'",
        "manifest-src 'none'",
        "media-src 'none'",
        "object-src 'none'",
        "prefetch-src 'none'",
        "script-src 'none'",
        "style-src 'none'",
        "worker-src 'none'",
    ]


@override_settings(
    THEME_CUSTOMIZATION_FILE_PATH="/not/existing/file.json",
)
@pytest.mark.parametrize("is_authenticated", [False, True])
def test_api_config_with_invalid_theme_customization_file(is_authenticated):
    """Anonymous users should be allowed to get the configuration."""
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory()
        client.force_login(user)

    response = client.get("/api/v1.0/config/")
    assert response.status_code == HTTP_200_OK
    content = response.json()
    assert content["theme_customization"] == {}


@override_settings(
    THEME_CUSTOMIZATION_FILE_PATH="/configuration/theme/invalid.json",
)
@pytest.mark.parametrize("is_authenticated", [False, True])
def test_api_config_with_invalid_json_theme_customization_file(is_authenticated, fs):
    """Anonymous users should be allowed to get the configuration."""
    fs.create_file(
        "/configuration/theme/invalid.json",
        contents="invalid json",
    )
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory()
        client.force_login(user)

    response = client.get("/api/v1.0/config/")
    assert response.status_code == HTTP_200_OK
    content = response.json()
    assert content["theme_customization"] == {}


@override_settings(
    THEME_CUSTOMIZATION_FILE_PATH="/configuration/theme/default.json",
)
@pytest.mark.parametrize("is_authenticated", [False, True])
def test_api_config_with_theme_customization(is_authenticated, fs):
    """Anonymous users should be allowed to get the configuration."""
    fs.create_file(
        "/configuration/theme/default.json",
        contents=json.dumps(
            {
                "colors": {
                    "primary": "#000000",
                    "secondary": "#000000",
                },
            }
        ),
    )
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory()
        client.force_login(user)

    response = client.get("/api/v1.0/config/")
    assert response.status_code == HTTP_200_OK
    content = response.json()
    assert content["theme_customization"] == {
        "colors": {
            "primary": "#000000",
            "secondary": "#000000",
        },
    }


@pytest.mark.parametrize("is_authenticated", [False, True])
def test_api_config_with_original_theme_customization(is_authenticated, settings):
    """Anonymous users should be allowed to get the configuration."""
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory()
        client.force_login(user)

    response = client.get("/api/v1.0/config/")
    assert response.status_code == HTTP_200_OK
    content = response.json()

    with open(settings.THEME_CUSTOMIZATION_FILE_PATH, "r", encoding="utf-8") as f:
        theme_customization = json.load(f)

    assert content["theme_customization"] == theme_customization
