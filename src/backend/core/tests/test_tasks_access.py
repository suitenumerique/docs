"""
Tests for the `reset_service_connections_in_cascade` Celery task in the
core.tasks.access module.
"""

from unittest import mock

from core.tasks.access import reset_service_connections_in_cascade


@mock.patch("core.tasks.access.CollaborationService")
def test_reset_service_connections_delegates_to_service(mock_service):
    """
    The task should delegate the whole reset to the CollaborationService,
    forwarding both the document id and the user id.
    """
    reset_service_connections_in_cascade("document-id", "user-id")

    mock_service.return_value.reset_connections.assert_called_once_with(
        "document-id", "user-id"
    )


@mock.patch("core.tasks.access.CollaborationService")
def test_reset_service_connections_defaults_user_id_to_none(mock_service):
    """When no user id is provided, the task should forward None to the service."""
    reset_service_connections_in_cascade("document-id")

    mock_service.return_value.reset_connections.assert_called_once_with(
        "document-id", None
    )
