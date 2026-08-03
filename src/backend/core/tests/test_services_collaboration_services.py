"""
This module contains tests for the CollaborationService class in the
core.services.collaboration_services module.
"""

import responses

from core.services.collaboration_services import CollaborationService


def test_reset_connections_makes_no_http_call():
    """
    TODO(yhub): yhub has no kick API, so reset_connections is a no-op. It must
    neither make any HTTP call nor raise, even without any collaboration
    settings configured.
    """
    with responses.RequestsMock():
        CollaborationService().reset_connections("document-id")
        CollaborationService().reset_connections("document-id", user_id="user-id")


def test_get_document_connection_info_makes_no_http_call():
    """
    TODO(yhub): yhub has no connection-info API, so get_document_connection_info
    always reports nobody connected, without making any HTTP call.
    """
    with responses.RequestsMock():
        assert CollaborationService().get_document_connection_info(
            "room", "session-key"
        ) == (0, False)
