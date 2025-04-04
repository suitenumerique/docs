"""Test the footer API."""

import responses
from rest_framework.test import APIClient


def test_api_footer_without_settings_configured(settings):
    """Test the footer API without settings configured."""
    settings.FRONTEND_URL_JSON_FOOTER = None
    client = APIClient()
    response = client.get("/api/v1.0/footer/")
    assert response.status_code == 200
    assert response.json() == {}


@responses.activate
def test_api_footer_with_invalid_request(settings):
    """Test the footer API with an invalid request."""
    settings.FRONTEND_URL_JSON_FOOTER = "https://invalid-request.com"

    footer_response = responses.get(settings.FRONTEND_URL_JSON_FOOTER, status=404)

    client = APIClient()
    response = client.get("/api/v1.0/footer/")
    assert response.status_code == 200
    assert response.json() == {}
    assert footer_response.call_count == 1


@responses.activate
def test_api_footer_with_invalid_json(settings):
    """Test the footer API with an invalid JSON response."""
    settings.FRONTEND_URL_JSON_FOOTER = "https://valid-request.com"

    footer_response = responses.get(
        settings.FRONTEND_URL_JSON_FOOTER, status=200, body="invalid json"
    )

    client = APIClient()
    response = client.get("/api/v1.0/footer/")
    assert response.status_code == 200
    assert response.json() == {}
    assert footer_response.call_count == 1


@responses.activate
def test_api_footer_with_valid_json(settings):
    """Test the footer API with an invalid JSON response."""
    settings.FRONTEND_URL_JSON_FOOTER = "https://valid-request.com"

    footer_response = responses.get(
        settings.FRONTEND_URL_JSON_FOOTER, status=200, json={"foo": "bar"}
    )

    client = APIClient()
    response = client.get("/api/v1.0/footer/")
    assert response.status_code == 200
    assert response.json() == {"foo": "bar"}
    assert footer_response.call_count == 1


@responses.activate
def test_api_footer_with_valid_json_and_cache(settings):
    """Test the footer API with an invalid JSON response."""
    settings.FRONTEND_URL_JSON_FOOTER = "https://valid-request.com"

    footer_response = responses.get(
        settings.FRONTEND_URL_JSON_FOOTER, status=200, json={"foo": "bar"}
    )

    client = APIClient()
    response = client.get("/api/v1.0/footer/")
    assert response.status_code == 200
    assert response.json() == {"foo": "bar"}
    assert footer_response.call_count == 1

    response = client.get("/api/v1.0/footer/")
    assert response.status_code == 200
    assert response.json() == {"foo": "bar"}
    # The cache should have been used
    assert footer_response.call_count == 1
