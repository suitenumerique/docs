"""
Tests for the `reset_service_connections_in_cascade` Celery task in the
core.tasks.access module.
"""

from unittest import mock

import pytest

from core import factories
from core.services.yhub_services import ServiceUnavailableError
from core.tasks.access import reset_service_connections_in_cascade

pytestmark = pytest.mark.django_db


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_resets_the_document(mock_service):
    """The task should reset the connections of the document it is given."""
    document = factories.DocumentFactory()

    reset_service_connections_in_cascade(str(document.id))

    mock_service.return_value.reset_connections.assert_called_once_with(document, None)


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_forwards_the_user_id(mock_service):
    """The user whose access changed should be forwarded to the service."""
    document = factories.DocumentFactory()

    reset_service_connections_in_cascade(str(document.id), "user-id")

    mock_service.return_value.reset_connections.assert_called_once_with(
        document, "user-id"
    )


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_in_cascade(mock_service):
    """
    A document inherits the accesses of its ancestors, so the whole subtree
    should be reset, the document itself included and its ancestors left out.
    """
    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    child = factories.DocumentFactory(parent=document)
    grand_child = factories.DocumentFactory(parent=child)
    factories.DocumentFactory()  # a document of another tree

    reset_service_connections_in_cascade(str(document.id))

    assert mock_service.return_value.reset_connections.call_args_list == [
        mock.call(document, None),
        mock.call(child, None),
        mock.call(grand_child, None),
    ]


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_unknown_document(mock_service):
    """A document deleted in the meantime should not reach the service."""
    reset_service_connections_in_cascade("d43ea3c5-b8ee-4a4a-9c60-2ad7a1d9e6cf")

    mock_service.return_value.reset_connections.assert_not_called()


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_keeps_going_on_failure(mock_service):
    """A document failing should not deprive the ones after it of their reset."""
    document = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=document)
    mock_service.return_value.reset_connections.side_effect = [
        ServiceUnavailableError("yhub is down"),
        None,
    ]

    reset_service_connections_in_cascade(str(document.id))

    assert mock_service.return_value.reset_connections.call_args_list == [
        mock.call(document, None),
        mock.call(child, None),
    ]
