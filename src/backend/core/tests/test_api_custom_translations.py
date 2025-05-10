"""Test the custom-translations API."""

import responses
from rest_framework.test import APIClient


def test_api_custom_translations_without_settings_configured(settings):
    """Test the custom-translations API without settings configured."""
    settings.FRONTEND_URL_JSON_CUSTOM_TRANSLATIONS = None
    client = APIClient()
    response = client.get("/api/v1.0/custom-translations/")
    assert response.status_code == 200
    assert response.json() == {}


@responses.activate
def test_api_custom_translations_with_invalid_request(settings):
    """Test the custom-translations API with an invalid request."""
    settings.FRONTEND_URL_JSON_CUSTOM_TRANSLATIONS = "https://invalid-request.com"

    custom_translations_response = responses.get(
        settings.FRONTEND_URL_JSON_CUSTOM_TRANSLATIONS, status=404
    )

    client = APIClient()
    response = client.get("/api/v1.0/custom-translations/")
    assert response.status_code == 200
    assert response.json() == {}
    assert custom_translations_response.call_count == 1


@responses.activate
def test_api_custom_translations_with_invalid_json(settings):
    """Test the custom-translations API with an invalid JSON response."""
    settings.FRONTEND_URL_JSON_CUSTOM_TRANSLATIONS = "https://valid-request.com"

    custom_translations_response = responses.get(
        settings.FRONTEND_URL_JSON_CUSTOM_TRANSLATIONS, status=200, body="invalid json"
    )

    client = APIClient()
    response = client.get("/api/v1.0/custom-translations/")
    assert response.status_code == 200
    assert response.json() == {}
    assert custom_translations_response.call_count == 1


@responses.activate
def test_api_custom_translations_with_valid_json(settings):
    """Test the custom-translations API with an invalid JSON response."""
    settings.FRONTEND_URL_JSON_CUSTOM_TRANSLATIONS = "https://valid-request.com"

    custom_translations_response = responses.get(
        settings.FRONTEND_URL_JSON_CUSTOM_TRANSLATIONS, status=200, json={"foo": "bar"}
    )

    client = APIClient()
    response = client.get("/api/v1.0/custom-translations/")
    assert response.status_code == 200
    assert response.json() == {"foo": "bar"}
    assert custom_translations_response.call_count == 1


@responses.activate
def test_api_custom_translations_with_valid_json_and_cache(settings):
    """Test the custom-translations API with an invalid JSON response."""
    settings.FRONTEND_URL_JSON_CUSTOM_TRANSLATIONS = "https://valid-request.com"

    custom_translations_response = responses.get(
        settings.FRONTEND_URL_JSON_CUSTOM_TRANSLATIONS, status=200, json={"foo": "bar"}
    )

    client = APIClient()
    response = client.get("/api/v1.0/custom-translations/")
    assert response.status_code == 200
    assert response.json() == {"foo": "bar"}
    assert custom_translations_response.call_count == 1

    response = client.get("/api/v1.0/custom-translations/")
    assert response.status_code == 200
    assert response.json() == {"foo": "bar"}
    # The cache should have been used
    assert custom_translations_response.call_count == 1
