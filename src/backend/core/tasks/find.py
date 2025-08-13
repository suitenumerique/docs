"""Trigger document indexation using celery task."""

from logging import getLogger

from django.conf import settings
from django.core.cache import cache
from django.db import transaction

from core import models
from core.services.search_indexers import (
    FindDocumentIndexer,
    get_batch_accesses_by_users_and_teams,
)

from impress.celery_app import app

logger = getLogger(__file__)


def document_indexer_debounce_key(document_id):
    """Returns debounce cache key"""
    return f"doc-indexer-debounce-{document_id}"


def incr_counter(key):
    """Increase or reset counter"""
    try:
        return cache.incr(key)
    except ValueError:
        cache.set(key, 1)
        return 1


def decr_counter(key):
    """Decrease or reset counter"""
    try:
        return cache.decr(key)
    except ValueError:
        cache.set(key, 0)
        return 0


@app.task
def document_indexer_task(document_id):
    """Send indexation query for a document using celery task."""
    key = document_indexer_debounce_key(document_id)

    # check if the counter : if still up, skip the task. only the last one
    # within the countdown delay will do the query.
    if decr_counter(key) > 0:
        logger.info("Skip document %s indexation", document_id)
        return

    doc = models.Document.objects.get(pk=document_id)
    indexer = FindDocumentIndexer()
    accesses = get_batch_accesses_by_users_and_teams((doc.path,))

    data = indexer.serialize_document(document=doc, accesses=accesses)

    logger.info("Start document %s indexation", document_id)
    indexer.push(data)


def trigger_document_indexer(document, on_commit=False):
    """
    Trigger indexation task with debounce a delay set by the SEARCH_INDEXER_COUNTDOWN setting.

    Args:
        document (Document): The document instance.
        on_commit (bool): Wait for the end of the transaction before starting the task
            (some fields may be in wrong state within the transaction)
    """

    if document.deleted_at or document.ancestors_deleted_at:
        pass

    if on_commit:

        def _aux():
            trigger_document_indexer(document, on_commit=False)

        transaction.on_commit(_aux)
    else:
        key = document_indexer_debounce_key(document.pk)
        countdown = getattr(settings, "SEARCH_INDEXER_COUNTDOWN", 1)

        logger.info(
            "Add task for document %s indexation in %.2f seconds",
            document.pk,
            countdown,
        )

        # Each time this method is called during the countdown, we increment the
        # counter and each task decrease it, so the index be run only once.
        incr_counter(key)

        document_indexer_task.apply_async(args=[document.pk], countdown=countdown)
