"""Tasks dedicated to document's accesses."""

from logging import getLogger

from core import models
from core.services.yhub_services import YHubError, YHubService

from impress.celery_app import app

logger = getLogger(__name__)


@app.task
def reset_service_connections_in_cascade(document_id, user_id=None):
    """
    Reset the connections of a document and all its descendants on the
    collaboration server.

    A document inherits the accesses of its ancestors, so a change on one of
    them can revoke the access to the whole subtree: yhub re-checks every
    connection of each document and disconnects the ones that lost their
    access. The endpoint is document scoped, hence the walk down the tree.

    A document failing is logged and does not stop the ones after it, its
    clients keep the rights they connected with until they reconnect.
    """
    try:
        document = models.Document.objects.get(pk=document_id)
    except models.Document.DoesNotExist:
        logger.error("Document %s does not exists anymore", document_id)
        return

    documents = models.Document.objects.filter(
        path__startswith=document.path, depth__gte=document.depth
    ).order_by("path")

    service = YHubService()
    for doc in documents:
        try:
            service.reset_connections(doc, user_id)
        except YHubError:
            logger.exception("impossible to reset connections for document %s", doc.id)
