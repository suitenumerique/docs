"""Collaboration services."""

from logging import getLogger

logger = getLogger(__name__)


class CollaborationService:
    """Service class for Collaboration related operations."""

    def reset_connections(self, document_id, user_id=None):
        """
        Reset the connections of a document and all its descendants in the
        collaboration server.

        TODO(yhub): yhub exposes no kick API, so this is a no-op. The regression
        is stronger than losing the hocuspocus disconnect: a revoked user keeps
        their already-authorized websocket until it closes on its own, and the
        edits they push in the meantime are durably persisted and re-served by
        yhub (hocuspocus lost them with the room). Until yhub grows a kick API,
        the manual remediation is yhub's rollback endpoint — per document:
        `POST /rollback/{org}/{docid}` with a lib0-encoded body containing
        `{"by": "<userid>"}` (see yhub API.md "Rollback"), authenticated as a
        user with update ability on the document.
        """
        logger.info(
            "reset_connections is a no-op (no yhub kick API), document %s, user %s",
            document_id,
            user_id,
        )

    # pylint: disable=unused-argument
    def get_document_connection_info(self, room, session_key):
        """
        Get the connection info for a document.

        TODO(yhub): yhub exposes no connection-info API, so pretend nobody is
        connected. Callers fall back to the cache-lock no-websocket path.
        """
        return 0, False
