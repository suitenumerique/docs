"""
Declare and configure the signals for the impress core application
"""

from functools import partial

from django.core.cache import cache
from django.db import transaction
from django.db.models import signals
from django.dispatch import receiver

from core import models
from core.tasks.search import trigger_batch_document_indexer
from core.utils import get_users_sharing_documents_with_cache_key


@receiver(signals.post_save, sender=models.Document)
def document_post_save(sender, instance, **kwargs):  # pylint: disable=unused-argument
    """
    Asynchronous call to the document indexer at the end of the transaction.
    Note : Within the transaction we can have an empty content and a serialization
    error.
    """
    transaction.on_commit(partial(trigger_batch_document_indexer, instance))


@receiver(signals.post_save, sender=models.DocumentAccess)
def document_access_post_save(sender, instance, created, **kwargs):  # pylint: disable=unused-argument
    """
    Asynchronous call to the document indexer at the end of the transaction.
    Clear cache for the affected user.
    """
    if not created:
        transaction.on_commit(
            partial(trigger_batch_document_indexer, instance.document)
        )

    # Invalidate cache for the user
    if instance.user:
        cache_key = get_users_sharing_documents_with_cache_key(instance.user)
        cache.delete(cache_key)


@receiver(signals.post_delete, sender=models.DocumentAccess)
def document_access_post_delete(sender, instance, **kwargs):  # pylint: disable=unused-argument
    """
    Clear cache for the affected user when document access is deleted.
    """
    if instance.user:
        cache_key = get_users_sharing_documents_with_cache_key(instance.user)
        cache.delete(cache_key)
