"""
Unit tests for the notification of the participants of a thread by the
Comment model.
"""

from datetime import timedelta
from unittest import mock

from django.core import mail
from django.db import connection
from django.test.utils import CaptureQueriesContext

import pytest

from core import factories, models

pytestmark = pytest.mark.django_db


def _document_with_thread(**thread_kwargs):
    """Return a document, its thread and the author of the reply to notify."""
    author = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    thread = factories.ThreadFactory(document=document, **thread_kwargs)
    factories.UserDocumentAccessFactory(document=document, user=author, role="editor")
    return document, thread, author


def _participant(document, role="commenter", **kwargs):
    """Create a user with an explicit access on the document."""
    user = factories.UserFactory(**kwargs)
    factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    return user


def test_models_comment_recipients_thread_creator_and_earlier_authors():
    """The creator of the thread and the authors of earlier comments are notified."""
    document, thread, author = _document_with_thread()
    creator = thread.creator
    factories.UserDocumentAccessFactory(
        document=document, user=creator, role="commenter"
    )
    earlier = _participant(document, role="editor")
    # Collaborator who never took part in the thread
    _participant(document)

    factories.CommentFactory(thread=thread, user=creator)
    factories.CommentFactory(thread=thread, user=earlier)
    reply = factories.CommentFactory(thread=thread, user=author)
    # A comment posted after the reply does not make its author a participant
    factories.CommentFactory(thread=thread, user=_participant(document))

    assert set(reply.get_notification_recipients()) == {creator, earlier}


def test_models_comment_recipients_exclude_author_and_deduplicate():
    """The author of the reply is never notified, the others only once."""
    document, thread, author = _document_with_thread(creator=None)
    other = _participant(document)
    factories.CommentFactory(thread=thread, user=author)
    factories.CommentFactory.create_batch(3, thread=thread, user=other)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.get_notification_recipients() == [other]


def test_models_comment_recipients_include_mentioned_users():
    """Users mentioned in the thread are participants, not those mentioned elsewhere."""
    document, thread, author = _document_with_thread(creator=None)
    mentioned = _participant(document)
    factories.MentionFactory(
        document=document,
        thread=thread,
        mentioned_user=mentioned,
        mentioned_by_user=_participant(document),
    )
    # Mentioned in the body of the document, not in the thread
    factories.MentionFactory(
        document=document, mentioned_user=_participant(document), thread=None
    )
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.get_notification_recipients() == [mentioned]


def test_models_comment_recipients_skip_users_mentioned_by_the_reply_author(settings):
    """
    A user mentioned by the author of the reply is already told by the mention
    notification: no second email, unless the mention is older than the cooldown.
    """
    settings.MENTION_NOTIFICATION_COOLDOWN_MINUTES = 15
    document, thread, author = _document_with_thread(creator=None)
    recently_mentioned = _participant(document)
    long_ago_mentioned = _participant(document)
    mentioned_by_other = _participant(document)
    for user in (recently_mentioned, long_ago_mentioned, mentioned_by_other):
        factories.CommentFactory(thread=thread, user=user)
    reply = factories.CommentFactory(thread=thread, user=author)

    factories.MentionFactory(
        document=document,
        thread=thread,
        mentioned_user=recently_mentioned,
        mentioned_by_user=author,
    )
    old_mention = factories.MentionFactory(
        document=document,
        thread=thread,
        mentioned_user=long_ago_mentioned,
        mentioned_by_user=author,
    )
    models.Mention.objects.filter(pk=old_mention.pk).update(
        created_at=reply.created_at - timedelta(minutes=16)
    )
    factories.MentionFactory(
        document=document,
        thread=thread,
        mentioned_user=mentioned_by_other,
        mentioned_by_user=_participant(document),
    )

    assert set(reply.get_notification_recipients()) == {
        long_ago_mentioned,
        mentioned_by_other,
    }


def test_models_comment_recipients_reader_is_excluded():
    """Readers cannot see comments: they are not notified."""
    document, thread, author = _document_with_thread(creator=None)
    reader = _participant(document, role="reader")
    factories.CommentFactory(thread=thread, user=reader)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.get_notification_recipients() == []


def test_models_comment_recipients_user_who_lost_access_is_excluded():
    """Users with no access to the document anymore are not notified."""
    _document, thread, author = _document_with_thread(creator=None)
    former_collaborator = factories.UserFactory()
    factories.CommentFactory(thread=thread, user=former_collaborator)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.get_notification_recipients() == []


def test_models_comment_recipients_link_role_is_not_enough():
    """A link role allowing to comment without an explicit access is not enough."""
    document = factories.DocumentFactory(link_reach="public", link_role="editor")
    thread = factories.ThreadFactory(document=document, creator=None)
    author = _participant(document, role="editor")
    visitor = factories.UserFactory()
    factories.CommentFactory(thread=thread, user=visitor)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.get_notification_recipients() == []


def test_models_comment_recipients_inherited_access():
    """An access inherited from an ancestor counts."""
    parent = factories.DocumentFactory(link_reach="restricted")
    document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    thread = factories.ThreadFactory(document=document, creator=None)
    author = _participant(document, role="editor")
    commenter = _participant(parent, role="commenter")
    reader = _participant(parent, role="reader")
    factories.CommentFactory(thread=thread, user=commenter)
    factories.CommentFactory(thread=thread, user=reader)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.get_notification_recipients() == [commenter]


def test_models_comment_recipients_skip_inactive_and_without_email():
    """Inactive users and users without an email address are left out."""
    document, thread, author = _document_with_thread(creator=None)
    for user in (
        _participant(document, is_active=False),
        _participant(document, email=None),
        _participant(document, email=""),
    ):
        factories.CommentFactory(thread=thread, user=user)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.get_notification_recipients() == []


def test_models_comment_recipients_deleted_users():
    """Comments of deleted users and threads without creator are ignored."""
    _document, thread, author = _document_with_thread(creator=None)
    factories.CommentFactory(thread=thread, user=None)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.get_notification_recipients() == []


def test_models_comment_recipients_team_access():
    """An access granted to a team of the user counts."""
    document, thread, author = _document_with_thread(creator=None)
    member = factories.UserFactory()
    outsider = factories.UserFactory()
    factories.TeamDocumentAccessFactory(
        document=document, team="team-a", role="commenter"
    )
    factories.CommentFactory(thread=thread, user=member)
    factories.CommentFactory(thread=thread, user=outsider)
    reply = factories.CommentFactory(thread=thread, user=author)

    with mock.patch.object(models.User, "teams", ["team-a"]):
        # Both users are in the team, so both of them are recipients
        assert reply.get_notification_recipients() == [member, outsider]

    assert reply.get_notification_recipients() == []


def test_models_comment_recipients_highest_role_wins():
    """A reader access on the document is overridden by an ancestor's role."""
    parent = factories.DocumentFactory(link_reach="restricted")
    document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    thread = factories.ThreadFactory(document=document, creator=None)
    author = _participant(document, role="editor")
    user = _participant(document, role="reader")
    factories.UserDocumentAccessFactory(document=parent, user=user, role="commenter")
    factories.CommentFactory(thread=thread, user=user)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.get_notification_recipients() == [user]


def test_models_comment_recipients_number_of_queries_is_constant():
    """The number of queries does not grow with the number of participants."""

    def count_queries(participants):
        document, thread, author = _document_with_thread(creator=None)
        for _ in range(participants):
            factories.CommentFactory(thread=thread, user=_participant(document))
        reply = factories.CommentFactory(thread=thread, user=author)
        with CaptureQueriesContext(connection) as queries:
            assert len(reply.get_notification_recipients()) == participants
        return len(queries)

    assert count_queries(1) == count_queries(5)


def test_models_comment_notify_thread_participants():
    """Each participant gets an email about the reply."""
    document = factories.DocumentFactory(title="My doc", link_reach="restricted")
    thread = factories.ThreadFactory(document=document)
    creator = thread.creator
    factories.UserDocumentAccessFactory(
        document=document, user=creator, role="commenter"
    )
    earlier = _participant(document, role="editor")
    author = _participant(document, role="editor", full_name="Replying User")
    factories.CommentFactory(thread=thread, user=earlier)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert set(reply.notify_thread_participants()) == {creator, earlier}

    # pylint: disable=no-member
    assert sorted(email.to[0] for email in mail.outbox) == sorted(
        [creator.email, earlier.email]
    )
    email = next(email for email in mail.outbox if email.to == [earlier.email])
    assert email.subject.lower() == (
        'replying user replied in a comment thread in "my doc"'
    )
    body = " ".join(email.body.split())
    assert (
        "Replying User replied in a comment thread in the following document: My doc"
        in body
    )
    assert f"docs/{document.id!s}/" in body


def test_models_comment_notify_thread_participants_uses_recipient_language():
    """The email is rendered in the language of each recipient."""
    document, thread, author = _document_with_thread(creator=None)
    french = _participant(document, language="fr-fr")
    no_language = _participant(document, language=None)
    factories.CommentFactory(thread=thread, user=french)
    factories.CommentFactory(thread=thread, user=no_language)
    author.language = "de-de"
    author.save()
    reply = factories.CommentFactory(thread=thread, user=author)

    with mock.patch.object(models.Document, "send_email") as mock_send_email:
        reply.notify_thread_participants()

    languages = {
        call.args[1][0]: call.args[3] for call in mock_send_email.call_args_list
    }
    # Falls back on the language of the author, like mention emails do
    assert languages == {french.email: "fr-fr", no_language.email: "de-de"}


def test_models_comment_notify_thread_participants_untitled_document():
    """An untitled document falls back to the generic title."""
    document, thread, author = _document_with_thread(creator=None)
    document.title = None
    document.save()
    participant = _participant(document, language="en-us")
    factories.CommentFactory(thread=thread, user=participant)
    reply = factories.CommentFactory(thread=thread, user=author)

    reply.notify_thread_participants()

    # pylint: disable-next=no-member
    assert 'in "untitled document"' in mail.outbox[0].subject.lower()


def test_models_comment_notify_thread_participants_without_recipient():
    """Nothing is sent when nobody has to be notified."""
    _document, thread, author = _document_with_thread(creator=None)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.notify_thread_participants() == []
    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0


def test_models_comment_notify_thread_participants_twice():
    """Notifying twice for the same comment does not email a user twice."""
    document, thread, author = _document_with_thread(creator=None)
    participant = _participant(document)
    factories.CommentFactory(thread=thread, user=participant)
    reply = factories.CommentFactory(thread=thread, user=author)

    assert reply.notify_thread_participants() == [participant]
    assert reply.notify_thread_participants() == []
    # pylint: disable-next=no-member
    assert len(mail.outbox) == 1


def test_models_comment_notify_thread_participants_failure_is_isolated():
    """A failing email is logged and the other participants are still notified."""
    document, thread, author = _document_with_thread(creator=None)
    first = _participant(document)
    second = _participant(document)
    factories.CommentFactory(thread=thread, user=first)
    factories.CommentFactory(thread=thread, user=second)
    reply = factories.CommentFactory(thread=thread, user=author)

    real_send_email = models.Document.send_email

    def flaky_send_email(self, subject, emails, context=None, language=None):
        if emails == [first.email]:
            raise RuntimeError("boom")
        return real_send_email(self, subject, emails, context, language)

    with mock.patch.object(models.Document, "send_email", flaky_send_email):
        assert reply.notify_thread_participants() == [second]

    # pylint: disable=no-member
    assert [email.to for email in mail.outbox] == [[second.email]]

    # The slot of the failed user was released: a retry notifies them only
    assert reply.notify_thread_participants() == [first]
    assert len(mail.outbox) == 2


def test_models_comment_notify_thread_participants_deleted_author():
    """A reply whose author was deleted is announced without a name."""
    document, thread, _author = _document_with_thread(creator=None)
    participant = _participant(document, language="en-us")
    factories.CommentFactory(thread=thread, user=participant)
    reply = factories.CommentFactory(thread=thread, user=None)

    assert reply.notify_thread_participants() == [participant]
    # pylint: disable-next=no-member
    assert mail.outbox[0].subject.lower().startswith("someone replied")


def test_models_comment_notify_thread_participants_smtp_failure_is_retried():
    """An SMTP failure, only logged by send_email, releases the slot of the user."""
    document, thread, author = _document_with_thread(creator=None)
    participant = _participant(document)
    factories.CommentFactory(thread=thread, user=participant)
    reply = factories.CommentFactory(thread=thread, user=author)

    with mock.patch.object(models.Document, "send_email", return_value=False):
        assert reply.notify_thread_participants() == []

    # The user was not notified, so a retry notifies them
    assert reply.notify_thread_participants() == [participant]
    # pylint: disable-next=no-member
    assert len(mail.outbox) == 1


def test_models_comment_notify_thread_participants_cache_unavailable():
    """The email is sent when the cache is down and its exceptions are ignored."""
    document, thread, author = _document_with_thread(creator=None)
    participant = _participant(document)
    factories.CommentFactory(thread=thread, user=participant)
    reply = factories.CommentFactory(thread=thread, user=author)

    # What django-redis returns for `add` on a connection error when
    # IGNORE_EXCEPTIONS is enabled, whereas an existing key gives False
    with mock.patch.object(models.cache, "add", return_value=None):
        assert reply.notify_thread_participants() == [participant]

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 1
