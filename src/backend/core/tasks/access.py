"""Tasks dedicated to document's accesses."""

from functools import partial
from logging import getLogger

from django.apps import apps
from django.db import transaction

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
    # resolved at run time: the models queue these tasks, importing them here
    # would import the models back
    document_model = apps.get_model("core", "Document")
    try:
        document = document_model.objects.get(pk=document_id)
    except document_model.DoesNotExist:
        # deleted for good in the meantime, its accesses with it: there is no
        # connection left to re-check, the deletion is reported to the
        # collaboration server by the code that deleted the document
        logger.info("Document %s does not exist anymore, nothing to reset", document_id)
        return

    documents = document_model.objects.filter(
        path__startswith=document.path, depth__gte=document.depth
    ).order_by("path")

    service = YHubService()
    for doc in documents:
        try:
            service.reset_connections(doc, user_id)
        except YHubError:
            logger.exception("impossible to reset connections for document %s", doc.id)


def reset_service_connections_on_commit(document_id, user_id=None):
    """
    Queue the reset of the connections of a document, and of its descendants,
    for when the current transaction is committed.

    The task reads the accesses back from the database to know what the
    collaboration server should re-check them against: queued before the
    commit, it could run against the accesses as they were. Outside of a
    transaction the task is queued right away.

    Naming a user restricts the re-check to their own connections, which is
    what the change of a single access needs; an access granted to a team, or
    a change of the whole scope of a document, names nobody and every
    connection is re-checked.
    """
    transaction.on_commit(
        partial(
            reset_service_connections_in_cascade.delay,
            str(document_id),
            str(user_id) if user_id else None,
        )
    )
