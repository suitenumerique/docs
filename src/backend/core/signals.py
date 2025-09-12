"""
Declare and configure the signals for the impress core application
"""

from django.db.models import signals
from django.dispatch import receiver

from . import models
from .tasks.find import trigger_document_indexer


@receiver(signals.post_save, sender=models.Document)
def document_post_save(sender, instance, **kwargs):  # pylint: disable=unused-argument
    """
    Asynchronous call to the document indexer at the end of the transaction.
    Note : Within the transaction we can have an empty content and a serialization
    error.
    """
    trigger_document_indexer(instance, on_commit=True)


@receiver(signals.post_save, sender=models.DocumentAccess)
def document_access_post_save(sender, instance, created, **kwargs):  # pylint: disable=unused-argument
    """
    Asynchronous call to the document indexer at the end of the transaction.
    """
    if not created:
        trigger_document_indexer(instance.document, on_commit=True)
