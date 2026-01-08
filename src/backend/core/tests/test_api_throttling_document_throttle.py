"""
Test DocumentThrottle for regular throttling and y-provider bypass.
"""

import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


def test_api_throttling_document_throttle_regular_requests(settings):
    """Test that regular requests are throttled normally."""

    current_rate = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["document"]
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["document"] = "3/minute"
    settings.Y_PROVIDER_API_KEY = "test-y-provider-key"

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user)

    # Make 3 requests without the y-provider key
    for _i in range(3):
        response = client.get(
            f"/api/v1.0/documents/{document.id!s}/",
        )
        assert response.status_code == 200

    # 4th request should be throttled
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
    )
    assert response.status_code == 429

    # A request with the y-provider key should NOT be throttled
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
        HTTP_X_Y_PROVIDER_KEY="test-y-provider-key",
    )
    assert response.status_code == 200

    # Restore original rate
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["document"] = current_rate


def test_api_throttling_document_throttle_y_provider_exempted(settings):
    """Test that y-provider requests are exempted from throttling."""

    current_rate = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["document"]
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["document"] = "3/minute"
    settings.Y_PROVIDER_API_KEY = "test-y-provider-key"

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user)

    # Make many requests with the y-provider API key
    for _i in range(10):
        response = client.get(
            f"/api/v1.0/documents/{document.id!s}/",
            HTTP_X_Y_PROVIDER_KEY="test-y-provider-key",
        )
        assert response.status_code == 200

    # Restore original rate
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["document"] = current_rate


def test_api_throttling_document_throttle_invalid_token(settings):
    """Test that requests with invalid tokens are throttled."""

    current_rate = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["document"]
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["document"] = "3/minute"
    settings.Y_PROVIDER_API_KEY = "test-y-provider-key"

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user)

    # Make 3 requests with an invalid token
    for _i in range(3):
        response = client.get(
            f"/api/v1.0/documents/{document.id!s}/",
            HTTP_X_Y_PROVIDER_KEY="invalid-token",
        )
        assert response.status_code == 200

    # 4th request should be throttled
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
        HTTP_X_Y_PROVIDER_KEY="invalid-token",
    )
    assert response.status_code == 429

    # Restore original rate
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["document"] = current_rate
