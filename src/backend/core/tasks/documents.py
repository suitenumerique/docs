"""Tasks dedicated to the documents themselves."""

from logging import getLogger

from core import models
from core.services.yhub_services import YHubError, YHubService

from impress.celery_app import app

logger = getLogger(__name__)


@app.task
def sync_service_deletions_in_cascade(document_id):
    """
    Report the deletion of a document and of its descendants to the
    collaboration server.

    The content of a document lives there, not here: until it is told, it keeps
    serving a deleted document to the clients already editing it, and its
    content outlives the document. The endpoint is document scoped, hence the
    walk down the tree — deleting a document deletes the subtree under it.

    Restoring goes through the very same walk. A restored document brings back
    only the part of its subtree that was deleted with it, the documents deleted
    on their own stay deleted, so what each document of the subtree needs is
    read from what it is now rather than from what was just done to it. Running
    this twice therefore changes nothing, and running it late still lands on the
    right answer.

    A document failing is logged and does not stop the ones after it; the
    collaboration server keeps serving it until something says so again.
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
        # a descendant carries the deletion of its ancestors, never its own
        # `deleted_at`, unless it was deleted on its own beforehand
        deleted = doc.deleted_at is not None or doc.ancestors_deleted_at is not None
        try:
            if deleted:
                service.delete_ydoc(doc)
            else:
                service.restore_ydoc(doc)
        except YHubError:
            logger.exception(
                "impossible to %s document %s on the collaboration server",
                "delete" if deleted else "restore",
                doc.id,
            )
