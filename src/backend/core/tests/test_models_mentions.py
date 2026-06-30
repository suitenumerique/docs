"""
Unit tests for the Mention model
"""

from django.core import mail

import pytest
from rest_framework.exceptions import ValidationError

from core import factories, models

pytestmark = pytest.mark.django_db


def test_models_mentions_str():
    """The str representation should mention both users and the document."""
    mention = factories.MentionFactory(
        document__title="My doc",
        mentioned_user__email="mentioned@example.com",
        mentioned_user__full_name=None,
        mentioned_by_user__email="author@example.com",
        mentioned_by_user__full_name=None,
    )
    assert (
        str(mention) == "author@example.com mentioned mentioned@example.com on My doc"
    )


def test_models_mentions_thread_other_document():
    """A mention cannot reference a thread from another document."""
    thread = factories.ThreadFactory()

    with pytest.raises(ValidationError) as excinfo:
        factories.MentionFactory(thread=thread)

    assert "The thread does not belong to this document." in str(excinfo.value)


def test_models_mentions_document_deletion_cascades():
    """Deleting a document should delete its mentions."""
    mention = factories.MentionFactory()
    mention.document.delete()
    assert models.Mention.objects.exists() is False


def test_models_mentions_thread_deletion_cascades():
    """Deleting a thread should delete the mentions linked to it."""
    document = factories.DocumentFactory()
    thread = factories.ThreadFactory(document=document)
    factories.MentionFactory(document=document, thread=thread)
    mention_in_body = factories.MentionFactory(document=document)

    thread.delete()

    assert list(models.Mention.objects.all()) == [mention_in_body]


def test_models_mentions_mentioned_user_deletion_sets_null():
    """Deleting the mentioned user should preserve the mention with a null user."""
    mention = factories.MentionFactory()
    mention.mentioned_user.delete()

    mention.refresh_from_db()
    assert mention.mentioned_user is None


def test_models_mentions_mentioned_by_user_deletion_cascades():
    """Deleting the mentioning user should delete the mention."""
    mention = factories.MentionFactory()
    mention.mentioned_by_user.delete()
    assert models.Mention.objects.exists() is False


def test_models_mentions_notify_mentioned_user_deleted():
    """Notifying a mention whose mentioned user was deleted should do nothing."""
    mention = factories.MentionFactory()
    mention.mentioned_user.delete()
    mention.refresh_from_db()

    assert mention.notify() is False
    assert mention.notified_at is None
    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0


def test_models_mentions_notify_concurrent_duplicate():
    """A notification should be suppressed when the context guard is already claimed.

    Simulates two notification tasks racing on the same context: the second
    task reads the database before the first one commits its `notified_at`
    update, so the cache guard is the only thing preventing a duplicate email.
    """
    document = factories.DocumentFactory()
    mentioned_user = factories.UserFactory()
    first = factories.MentionFactory(document=document, mentioned_user=mentioned_user)
    second = factories.MentionFactory(document=document, mentioned_user=mentioned_user)

    assert first.notify() is True

    # Hide the first notification from the database cooldown check, as a
    # concurrent task would see it before the first task commits.
    models.Mention.objects.filter(pk=first.pk).update(notified_at=None)
    assert second.is_notification_in_cooldown() is False

    assert second.notify() is False
    assert second.notified_at is None
    # pylint: disable-next=no-member
    assert len(mail.outbox) == 1
