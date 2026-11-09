"""Trigger document indexation using celery task."""

import operator
from functools import partial, reduce
from logging import getLogger

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q

from django_redis.cache import RedisCache

from core import models
from core.services.search_indexers import (
    get_document_indexer,
)

from impress.celery_app import app

logger = getLogger(__file__)


@app.task
def document_indexer_task(document_id):
    """Celery Task : Sends indexation query for a document."""
    indexer = get_document_indexer()

    if indexer:
        logger.info("Start document %s indexation", document_id)
        indexer.index(models.Document.objects.filter(pk=document_id))


def batch_indexer_throttle_acquire(timeout: int = 0, atomic: bool = True):
    """
    Enable the task throttle flag for a delay.
    Uses redis locks if available to ensure atomic changes
    """
    key = "document-batch-indexer-throttle"

    # Redis is used as cache database (not in tests). Use the lock feature here
    # to ensure atomicity of changes to the throttle flag.
    if isinstance(cache, RedisCache) and atomic:
        with cache.locks(key):
            return batch_indexer_throttle_acquire(timeout, atomic=False)

    # Use add() here :
    #   - set the flag and returns true if not exist
    #   - do nothing and return false if exist
    return cache.add(key, 1, timeout=timeout)


@app.task
def batch_document_indexer_task(timestamp):
    """Celery Task : Sends indexation query for a batch of documents."""
    indexer = get_document_indexer()

    if indexer:
        queryset = models.Document.objects.filter(
            Q(updated_at__gte=timestamp)
            | Q(deleted_at__gte=timestamp)
            | Q(ancestors_deleted_at__gte=timestamp)
        )

        count = indexer.index(queryset)
        logger.info("Indexed %d documents", count)


@app.task
def subtree_document_indexer_task(document_ids):
    """Celery Task : Sends indexation query for documents and their descendants."""
    indexer = get_document_indexer()

    if indexer:
        # Sorted, the descendants of a path follow it: only the top paths are kept
        roots = []
        for path in sorted(
            models.Document.objects.filter(pk__in=document_ids).values_list(
                "path", flat=True
            )
        ):
            if not roots or not path.startswith(roots[-1]):
                roots.append(path)
        if not roots:
            return

        queryset = models.Document.objects.filter(
            reduce(operator.or_, (Q(path__startswith=path) for path in roots))
        )

        count = indexer.index(queryset)
        logger.info("Indexed %d documents", count)


def trigger_subtree_document_indexer(document_ids):
    """
    Index documents and their descendants again once the current transaction is
    committed, whatever their last update.

    The users having access to a document are part of its search index and of the
    index of its descendants, which inherit its accesses. Unlike
    trigger_batch_document_indexer, it is not debounced: the batch of a countdown
    only indexes the documents updated since its first call.

    Args:
        document_ids (iterable of UUID): The ids of the documents whose accesses changed.
    """
    document_ids = [str(document_id) for document_id in document_ids]

    # DO NOT create a task if indexation is disabled
    if not settings.SEARCH_INDEXER_CLASS or not document_ids:
        return

    transaction.on_commit(partial(subtree_document_indexer_task.delay, document_ids))


def trigger_batch_document_indexer(document_id, updated_at):
    """
    Trigger indexation task with debounce a delay set by the SEARCH_INDEXER_COUNTDOWN setting.

    Args:
        document_id (UUID): The id of the document that changed.
        updated_at (datetime): When it changed, the horizon of the batch.
    """
    countdown = int(settings.SEARCH_INDEXER_COUNTDOWN)

    # DO NOT create a task if indexation if disabled
    if not settings.SEARCH_INDEXER_CLASS:
        return

    if countdown > 0:
        # Each time this method is called during a countdown, we increment the
        # counter and each task decrease it, so the index be run only once.
        if batch_indexer_throttle_acquire(timeout=countdown):
            logger.info(
                "Add task for batch document indexation from updated_at=%s in %d seconds",
                updated_at.isoformat(),
                countdown,
            )

            batch_document_indexer_task.apply_async(
                args=[updated_at], countdown=countdown
            )
        else:
            logger.info("Skip task for batch document %s indexation", document_id)
    else:
        # Indexing reads the content of the document from the collaboration
        # server and pushes it to the search backend: never in the process
        # asking for it.
        document_indexer_task.delay(document_id)
