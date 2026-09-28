"""
Tests for the `reset_service_connections_in_cascade` Celery task in the
core.tasks.access module.
"""

from unittest import mock

from django.core.exceptions import ImproperlyConfigured

import pytest

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


@mock.patch(
    "core.tasks.access.CollaborationService",
    side_effect=ImproperlyConfigured("Collaboration configuration not set"),
)
def test_reset_service_connections_propagates_improperly_configured(mock_service):  # pylint: disable=unused-argument
    """
    If the collaboration service is not configured, instantiating it raises
    ImproperlyConfigured, which should propagate out of the task.
    """
    with pytest.raises(ImproperlyConfigured):
        reset_service_connections_in_cascade("document-id")
