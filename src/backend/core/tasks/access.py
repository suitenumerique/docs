"""Tasks dedicated to document's accesses."""

from logging import getLogger

from django.apps import apps
from django.conf import settings
from django.db import transaction

from core.services.yhub_services import YHubError, YHubService

from impress.celery_app import app

logger = getLogger(__name__)

# where the resets queued by the current transaction wait on the connection
PENDING_RESETS_ATTRIBUTE = "yhub_pending_resets"


@app.task
def reset_service_connections_in_cascade(document_id, user_id=None, after_path=None):
    """
    Reset the connections of a document and all its descendants on the
    collaboration server.

    A document inherits the accesses of its ancestors, so a change on one of
    them can revoke the access to the whole subtree: yhub re-checks every
    connection of each document and disconnects the ones that lost their
    access. The endpoint is document scoped, hence the walk down the tree.

    The walk is paced: a run resets at most YHUB_RESET_CONNECTIONS_BATCH_SIZE
    documents, in the order of their paths, and queues the rest after
    YHUB_RESET_CONNECTIONS_DELAY seconds, from the last path it reached. A
    large subtree is thus spread over time rather than fired at the
    collaboration server at once, and no worker is held for its whole length.

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
    )
    if after_path:
        documents = documents.filter(path__gt=after_path)
    batch_size = settings.YHUB_RESET_CONNECTIONS_BATCH_SIZE
    # one more than the batch: whether anything is left to queue
    documents = list(documents.order_by("path")[: batch_size + 1])
    remaining = documents[batch_size:]
    documents = documents[:batch_size]

    service = YHubService()
    for doc in documents:
        try:
            service.reset_connections(doc, user_id)
        except YHubError:
            logger.exception("impossible to reset connections for document %s", doc.id)

    if remaining:
        reset_service_connections_in_cascade.apply_async(
            args=[document_id, user_id, documents[-1].path],
            countdown=settings.YHUB_RESET_CONNECTIONS_DELAY,
        )


class PendingResets:
    """
    The resets queued by one transaction, sent coalesced when it commits.

    A change of accesses often queues several resets of the same document: a
    move deletes every direct access of the document, one signal each, and
    then asks for the whole subtree. The users asked for are gathered per
    document, and a document asked for everybody (no user) is reset once, for
    everybody, whatever else was asked for it.
    """

    def __init__(self, batch):
        # the callbacks on commit of the transaction these resets belong to
        self.batch = batch
        self.users_by_document = {}
        self.flushed = False

    def add(self, document_id, user_id=None):
        """Ask for the reset of a document, for a user or for everybody."""
        users = self.users_by_document.setdefault(str(document_id), set())
        users.add(str(user_id) if user_id else None)

    def flush(self):
        """
        Queue the tasks, one per document and user, or per document.

        Registered on commit by every ask, so that a rollback of the savepoint
        of one of them still leaves a flush to run; the first to run sends
        everything, the ones after it find nothing to send.
        """
        if self.flushed:
            return
        self.flushed = True
        for document_id, users in self.users_by_document.items():
            if None in users:
                reset_service_connections_in_cascade.delay(document_id, None)
                continue
            for user_id in sorted(users):
                reset_service_connections_in_cascade.delay(document_id, user_id)


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

    The resets of one transaction are gathered and sent coalesced on commit
    (see `PendingResets`). They wait on the connection, bound to the list of
    callbacks on commit of their transaction: Django replaces that list on
    every commit and rollback, so what a rolled back transaction left behind
    is told apart and dropped.
    """
    connection = transaction.get_connection()
    pending = getattr(connection, PENDING_RESETS_ATTRIBUTE, None)
    if (
        pending is None
        or pending.flushed
        or pending.batch is not connection.run_on_commit
    ):
        pending = PendingResets(connection.run_on_commit)
        setattr(connection, PENDING_RESETS_ATTRIBUTE, pending)
    pending.add(document_id, user_id)
    # outside of a transaction this flushes right away, hence after the add
    transaction.on_commit(pending.flush)
