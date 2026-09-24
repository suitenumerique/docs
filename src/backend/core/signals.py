"""
Declare and configure the signals for the impress core application
"""

from functools import partial

from django.core.cache import cache
from django.db import transaction
from django.db.models import signals
from django.dispatch import receiver

from core import models
from core.tasks.access import reset_service_connections_on_commit
from core.tasks.search import trigger_batch_document_indexer
from core.utils.users import get_users_sharing_documents_with_cache_key


@receiver(signals.post_save, sender=models.Document)
def document_post_save(sender, instance, created, **kwargs):  # pylint: disable=unused-argument
    """
    Asynchronous call to the document indexer at the end of the transaction.
    Note : Within the transaction we can have an empty content and a serialization
    error.

    A change of the link definition changes who may open the document and its
    descendants, from wherever it was saved: the collaboration server is told
    to re-check their connections.
    """
    transaction.on_commit(
        partial(trigger_batch_document_indexer, instance.pk, instance.updated_at)
    )

    if not created and instance.link_definition_changed():
        reset_service_connections_on_commit(instance.pk)
    instance.remember_link_definition()


@receiver(signals.post_save, sender=models.DocumentAccess)
def document_access_post_save(sender, instance, created, **kwargs):  # pylint: disable=unused-argument
    """
    Asynchronous call to the document indexer at the end of the transaction.
    Clear cache for the affected user.

    Every change of an access, wherever it comes from (API, admin, an accepted
    access request...), is reported to the collaboration server so that the
    connections of the user, or of everybody for a team, are re-checked.
    """
    if not created:
        document = instance.document
        transaction.on_commit(
            partial(trigger_batch_document_indexer, document.pk, document.updated_at)
        )

    # Invalidate cache for the user
    cache_key = get_users_sharing_documents_with_cache_key(instance.user_id)
    cache.delete(cache_key)

    reset_service_connections_on_commit(instance.document_id, instance.user_id)


@receiver(signals.post_delete, sender=models.DocumentAccess)
def document_access_post_delete(sender, instance, **kwargs):  # pylint: disable=unused-argument
    """
    Clear cache for the affected user when document access is deleted, and
    have the collaboration server re-check their connections: they may have
    lost their access, or an inherited one.
    """
    cache_key = get_users_sharing_documents_with_cache_key(instance.user_id)
    cache.delete(cache_key)

    reset_service_connections_on_commit(instance.document_id, instance.user_id)
