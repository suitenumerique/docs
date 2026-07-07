"""Tasks dedicated to document's accesses."""

from core.services.collaboration_services import CollaborationService

from impress.celery_app import app


@app.task
def reset_service_connections_in_cascade(document_id, user_id=None):
    """
    For a given document_id, reset the connections of the document and all its
    descendants by delegating to the CollaborationService.
    """
    CollaborationService().reset_connections(document_id, user_id)
