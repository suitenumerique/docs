"""Trigger document indexation using celery task."""

from logging import getLogger

from django.conf import settings
from django.core.cache import cache as django_cache

from impress.celery_app import app

logger = getLogger(__file__)


def indexer_debounce_lock(document_id):
    """Increase or reset counter"""
    key = f"doc-indexer-debounce-{document_id}"

    try:
        return django_cache.incr(key)
    except ValueError:
        django_cache.set(key, 1)
        return 1


def indexer_debounce_release(document_id):
    """Decrease or reset counter"""
    key = f"doc-indexer-debounce-{document_id}"

    try:
        return django_cache.decr(key)
    except ValueError:
        django_cache.set(key, 0)
        return 0


@app.task
def document_indexer_task(document_id):
    """Celery Task : Sends indexation query for a document."""
    # Prevents some circular imports
    # pylint: disable=import-outside-toplevel
    from core import models
    from core.services.search_indexers import (  # noqa : PLC0415
        get_batch_accesses_by_users_and_teams,
        get_document_indexer,
    )

    # check if the counter : if still up, skip the task. only the last one
    # within the countdown delay will do the query.
    if indexer_debounce_release(document_id) > 0:
        logger.info("Skip document %s indexation", document_id)
        return

    indexer = get_document_indexer()

    if indexer is None:
        return

    doc = models.Document.objects.get(pk=document_id)
    accesses = get_batch_accesses_by_users_and_teams((doc.path,))

    data = indexer.serialize_document(document=doc, accesses=accesses)

    logger.info("Start document %s indexation", document_id)
    indexer.push(data)


def trigger_document_indexer(document):
    """
    Trigger indexation task with debounce a delay set by the SEARCH_INDEXER_COUNTDOWN setting.

    Args:
        document (Document): The document instance.
    """
    countdown = settings.SEARCH_INDEXER_COUNTDOWN

    # DO NOT create a task if indexation if disabled
    if not settings.SEARCH_INDEXER_CLASS:
        return

    logger.info(
        "Add task for document %s indexation in %.2f seconds",
        document.pk,
        countdown,
    )

    # Each time this method is called during the countdown, we increment the
    # counter and each task decrease it, so the index be run only once.
    indexer_debounce_lock(document.pk)

    document_indexer_task.apply_async(args=[document.pk], countdown=countdown)
