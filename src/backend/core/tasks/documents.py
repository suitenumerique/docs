"""Tasks dedicated to the documents themselves."""

from logging import getLogger

from django.apps import apps

from celery.exceptions import MaxRetriesExceededError

from core.services.yhub_services import YHubError, YHubService

from impress.celery_app import app

logger = getLogger(__name__)


@app.task
def sync_service_restorations_in_cascade(document_id):
    """
    Report the restoration of a document and of its descendants to the
    collaboration server.

    A soft deletion is no longer reported: the document stays readable there
    and the access rights it re-checks make it read-only, while a reset of the
    connections on the deletion closes the clients still editing it (see
    `reset_service_connections_on_commit`). A deletion report would tombstone
    the document in the collaboration server and make it unreachable from the
    editor, which is what restoring a document must undo.

    The restoration is still reported, as a safety net: nothing on this code
    tombstones the room of a soft-deleted document, but something acting on
    yhub with the admin token could, and only this call lifts a tombstone.
    Running it twice changes nothing, and running it late still lands on the
    right answer.

    A restored document brings back only the part of its subtree that was
    deleted with it, the documents deleted on their own stay deleted: what
    each document of the subtree needs is read from what it is now rather than
    from what was just done to it, so the walk reports the restoration of the
    documents that are back and leaves the others alone.
    """
    # resolved at run time: the models queue these tasks, importing them here
    # would import the models back
    document_model = apps.get_model("core", "Document")
    try:
        document = document_model.objects.get(pk=document_id)
    except document_model.DoesNotExist:
        logger.error("Document %s does not exists anymore", document_id)
        return

    documents = document_model.objects.filter(
        path__startswith=document.path, depth__gte=document.depth
    ).order_by("path")

    service = YHubService()
    for doc in documents:
        # a descendant carries the deletion of its ancestors, never its own
        # `deleted_at`, unless it was deleted on its own beforehand
        if doc.deleted_at is not None or doc.ancestors_deleted_at is not None:
            # still deleted: its room was never deleted in the collaboration
            # server, whose access re-checks already make it read-only
            continue
        try:
            service.restore_ydoc(doc)
        except YHubError:
            logger.exception(
                "impossible to restore document %s on the collaboration server",
                doc.id,
            )


# how long a retry of `delete_service_documents` waits, doubled at each attempt
DELETE_RETRY_COUNTDOWN = 30
DELETE_RETRY_MAX_COUNTDOWN = 600


@app.task(bind=True, max_retries=5)
def delete_service_documents(self, document_ids):
    """
    Report to the collaboration server the deletion of documents that are gone
    for good from the database.

    Nothing else knows of these deletions anymore, so a failure is retried,
    for the documents that failed only, with a countdown doubling at each
    attempt. Once the retries are spent, the ids are logged as an error: it
    is all that is left to delete them by hand.
    """
    service = YHubService()
    failed = []
    for document_id in document_ids:
        try:
            service.delete_ydoc(document_id)
        except YHubError:
            logger.warning(
                "impossible to delete document %s on the collaboration server, "
                "will retry",
                document_id,
            )
            failed.append(document_id)

    if not failed:
        return

    try:
        self.retry(
            args=[failed],
            countdown=min(
                DELETE_RETRY_MAX_COUNTDOWN,
                DELETE_RETRY_COUNTDOWN * 2**self.request.retries,
            ),
        )
    except MaxRetriesExceededError:
        logger.error(
            "giving up on deleting documents %s on the collaboration server "
            "after %d attempts",
            ", ".join(failed),
            self.request.retries + 1,
        )
