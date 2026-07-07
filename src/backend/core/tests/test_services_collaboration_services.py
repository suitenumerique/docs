"""
This module contains tests for the CollaborationService class in the
core.services.collaboration_services module.
"""

import json
import logging
import re
from contextlib import contextmanager
from unittest import mock
from uuid import uuid4

from django.core.exceptions import ImproperlyConfigured

import pytest
import requests
import responses

from core import factories, models
from core.services.collaboration_services import CollaborationService

# pylint: disable=protected-access


@pytest.fixture(name="mock_reset_connections")
def mock_reset_connections_fixture(settings):
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
def test_reset_connection_with_user_id(settings):
    """Test _reset_connection with a provided user_id."""
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    service = CollaborationService()

    room = "room1"
    user_id = "user123"
    endpoint_url = "http://example.com/reset-connections/?room=" + room

    responses.add(responses.POST, endpoint_url, json={}, status=200)

    service._reset_connection(room, user_id)

    assert len(responses.calls) == 1
    request = responses.calls[0].request

    assert request.url == endpoint_url
    assert request.headers.get("Authorization") == "secret-token"
    assert request.headers.get("X-User-Id") == "user123"


@responses.activate
def test_reset_connection_without_user_id(settings):
    """Test _reset_connection without a user_id."""
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

    service._reset_connection(room, user_id)

    assert len(responses.calls) == 1
    request = responses.calls[0].request

    assert request.url == endpoint_url
    assert request.headers.get("Authorization") == "secret-token"
    assert request.headers.get("X-User-Id") is None


@responses.activate
def test_reset_connection_non_200_response(settings):
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
        service._reset_connection(room, user_id)

    assert len(responses.calls) == 1


@responses.activate
def test_reset_connection_request_exception(settings):
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
        service._reset_connection(room, user_id)

    assert len(responses.calls) == 1


@pytest.fixture(name="collaboration_service")
def collaboration_service_fixture(settings):
    """Return a configured CollaborationService instance."""
    settings.COLLABORATION_API_URL = "http://example.com/"
    settings.COLLABORATION_SERVER_SECRET = "secret-token"
    return CollaborationService()


@pytest.mark.django_db
@mock.patch.object(CollaborationService, "_reset_connection")
def test_reset_connections_document_does_not_exist(
    mock_reset_connection,
    collaboration_service,
    caplog,
):
    """
    When the document does not exist anymore, an error is logged and no
    connection is reset.
    """
    unknown_id = uuid4()

    with caplog.at_level(logging.ERROR, logger="core.services.collaboration_services"):
        collaboration_service.reset_connections(unknown_id)

    mock_reset_connection.assert_not_called()
    assert f"Document {unknown_id} does not exists anymore" in caplog.text


@pytest.mark.django_db
@mock.patch.object(CollaborationService, "_reset_connection")
def test_reset_connections_single_document(
    mock_reset_connection,
    collaboration_service,
):
    """A document without descendants should have its own connections reset."""
    document = factories.DocumentFactory()

    collaboration_service.reset_connections(document.id)

    mock_reset_connection.assert_called_once_with(document.id, None)


@pytest.mark.django_db
@mock.patch.object(CollaborationService, "_reset_connection")
def test_reset_connections_cascade_on_document_and_descendants(
    mock_reset_connection,
    collaboration_service,
):
    """
    The document itself and every one of its descendants should be reset,
    ordered by path.
    """
    root = factories.DocumentFactory()
    child1 = factories.DocumentFactory(parent=root)
    child2 = factories.DocumentFactory(parent=root)
    grandchild = factories.DocumentFactory(parent=child1)

    collaboration_service.reset_connections(root.id)

    expected_ids = [
        doc.id
        for doc in models.Document.objects.filter(
            path__startswith=root.path, depth__gte=root.depth
        ).order_by("path")
    ]
    assert set(expected_ids) == {root.id, child1.id, child2.id, grandchild.id}

    called_ids = [call.args[0] for call in mock_reset_connection.call_args_list]
    assert called_ids == expected_ids
    assert mock_reset_connection.call_count == 4


@pytest.mark.django_db
@mock.patch.object(CollaborationService, "_reset_connection")
def test_reset_connections_starts_from_a_sub_document(
    mock_reset_connection,
    collaboration_service,
):
    """
    When called on a sub-document, only that sub-document and its own
    descendants should be reset, not its ancestors or siblings.
    """
    root = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=root)
    sibling = factories.DocumentFactory(parent=root)
    grandchild = factories.DocumentFactory(parent=child)

    collaboration_service.reset_connections(child.id)

    called_ids = {call.args[0] for call in mock_reset_connection.call_args_list}
    assert called_ids == {child.id, grandchild.id}
    assert root.id not in called_ids
    assert sibling.id not in called_ids


@pytest.mark.django_db
@mock.patch.object(CollaborationService, "_reset_connection")
def test_reset_connections_forwards_user_id(
    mock_reset_connection,
    collaboration_service,
):
    """The provided user_id should be forwarded to every reset call."""
    root = factories.DocumentFactory()
    factories.DocumentFactory(parent=root)
    user_id = str(uuid4())

    collaboration_service.reset_connections(root.id, user_id=user_id)

    assert mock_reset_connection.call_count == 2
    for call in mock_reset_connection.call_args_list:
        assert call.args[1] == user_id


@pytest.mark.django_db
@mock.patch.object(CollaborationService, "_reset_connection")
def test_reset_connections_continues_on_http_error(
    mock_reset_connection,
    collaboration_service,
    caplog,
):
    """
    An HTTPError raised while resetting one document should be logged and must
    not prevent the remaining documents from being processed.
    """
    root = factories.DocumentFactory()
    child1 = factories.DocumentFactory(parent=root)
    child2 = factories.DocumentFactory(parent=root)

    ordered_docs = list(
        models.Document.objects.filter(
            path__startswith=root.path, depth__gte=root.depth
        ).order_by("path")
    )
    failing_doc = ordered_docs[1]

    def _side_effect(room, _user_id=None):
        if room == failing_doc.id:
            raise requests.HTTPError("boom")

    mock_reset_connection.side_effect = _side_effect

    with caplog.at_level(logging.ERROR, logger="core.services.collaboration_services"):
        collaboration_service.reset_connections(root.id)

    assert mock_reset_connection.call_count == 3
    called_ids = [call.args[0] for call in mock_reset_connection.call_args_list]
    assert set(called_ids) == {root.id, child1.id, child2.id}

    assert (
        f"impossible to reset connections for document {failing_doc.id}" in caplog.text
    )
