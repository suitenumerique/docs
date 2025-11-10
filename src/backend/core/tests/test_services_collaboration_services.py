"""
This module contains tests for the CollaborationService class in the
core.services.collaboration_services module.
"""

import json
import re
from contextlib import contextmanager

from django.core.exceptions import ImproperlyConfigured

import pytest
import requests
import responses

from core.services.collaboration_services import CollaborationService


@pytest.fixture
def mock_reset_connections(settings):
    """
    Creates a context manager to mock the reset-connections endpoint for collaboration services.
    Args:
        settings: A settings object that contains the configuration for the collaboration API.
    Returns:
        A context manager function that mocks the reset-connections endpoint.
    The context manager function takes the following parameters:
        document_id (str): The ID of the document for which connections are being reset.
        user_id (str, optional): The ID of the user making the request. Defaults to None.
    Usage:
        with mock_reset_connections(settings)(document_id, user_id) as mock:
            # Your test code here
    The context manager performs the following actions:
        - Mocks the reset-connections endpoint using responses.RequestsMock.
        - Sets the COLLABORATION_API_URL and COLLABORATION_SERVER_SECRET in the settings.
        - Verifies that the reset-connections endpoint is called exactly once.
        - Checks that the request URL and headers are correct.
        - If user_id is provided, checks that the X-User-Id header is correct.
    """

    @contextmanager
    def _mock_reset_connections(document_id, user_id=None):
        with responses.RequestsMock() as rsps:
            # Mock the reset-connections endpoint
            settings.COLLABORATION_API_URL = "http://example.com/"
            settings.COLLABORATION_SERVER_SECRET = "secret-token"
            endpoint_url = (
                f"{settings.COLLABORATION_API_URL}reset-connections/?room={document_id}"
            )
            rsps.add(
                responses.POST,
                endpoint_url,
                json={},
                status=200,
            )
            yield

            assert len(rsps.calls) == 1, (
                "Expected one call to reset-connections endpoint"
            )
            request = rsps.calls[0].request
            assert request.url == endpoint_url, f"Unexpected URL called: {request.url}"
            assert (
                request.headers.get("Authorization")
                == settings.COLLABORATION_SERVER_SECRET
            ), "Incorrect Authorization header"

            if user_id:
                assert request.headers.get("X-User-Id") == user_id, (
                    "Incorrect X-User-Id header"
                )

    return _mock_reset_connections


def test_init_without_api_url(settings):
    """Test that ImproperlyConfigured is raised when COLLABORATION_API_URL is None."""
    settings.COLLABORATION_API_URL = None
    with pytest.raises(ImproperlyConfigured):
        CollaborationService()


def test_init_with_api_url(settings):
    """Test that the service initializes correctly when COLLABORATION_API_URL is set."""
    settings.COLLABORATION_API_URL = "http://example.com/"
    service = CollaborationService()
    assert isinstance(service, CollaborationService)


@responses.activate
def test_reset_connections_with_user_id(settings):
    """Test reset_connections with a provided user_id."""
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    service = CollaborationService()

    room = "room1"
    user_id = "user123"
    endpoint_url = "http://example.com/reset-connections/?room=" + room

    responses.add(responses.POST, endpoint_url, json={}, status=200)

    service.reset_connections(room, user_id)

    assert len(responses.calls) == 1
    request = responses.calls[0].request

    assert request.url == endpoint_url
    assert request.headers.get("Authorization") == "secret-token"
    assert request.headers.get("X-User-Id") == "user123"


@responses.activate
def test_reset_connections_without_user_id(settings):
    """Test reset_connections without a user_id."""
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    service = CollaborationService()

    room = "room1"
    user_id = None
    endpoint_url = "http://example.com/reset-connections/?room=" + room

    responses.add(
        responses.POST,
        endpoint_url,
        json={},
        status=200,
    )

    service.reset_connections(room, user_id)

    assert len(responses.calls) == 1
    request = responses.calls[0].request

    assert request.url == endpoint_url
    assert request.headers.get("Authorization") == "secret-token"
    assert request.headers.get("X-User-Id") is None


@responses.activate
def test_reset_connections_non_200_response(settings):
    """Test that an HTTPError is raised when the response status is not 200."""
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    service = CollaborationService()

    room = "room1"
    user_id = "user123"
    endpoint_url = "http://example.com/reset-connections/?room=" + room
    response_body = {"error": "Internal Server Error"}

    responses.add(responses.POST, endpoint_url, json=response_body, status=500)

    expected_exception_message = re.escape(
        "Failed to notify WebSocket server. Status code: 500, Response: "
    ) + re.escape(json.dumps(response_body))

    with pytest.raises(requests.HTTPError, match=expected_exception_message):
        service.reset_connections(room, user_id)

    assert len(responses.calls) == 1


@responses.activate
def test_reset_connections_request_exception(settings):
    """Test that an HTTPError is raised when a RequestException occurs."""
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    service = CollaborationService()

    room = "room1"
    user_id = "user123"
    endpoint_url = "http://example.com/reset-connections?room=" + room

    responses.add(
        responses.POST,
        endpoint_url,
        body=requests.exceptions.ConnectionError("Network error"),
    )

    with pytest.raises(requests.HTTPError, match="Failed to notify WebSocket server."):
        service.reset_connections(room, user_id)

    assert len(responses.calls) == 1
