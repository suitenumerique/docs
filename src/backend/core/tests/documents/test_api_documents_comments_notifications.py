"""
Tests for the email notification of the participants of a thread when a
comment is added to it, through the comments API and the Celery task.
"""

from unittest import mock

from django.core import mail

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tasks.mail import send_thread_reply_notification_mail

pytestmark = pytest.mark.django_db


def _post_comment(user, document, thread, body="reply"):
    """Post a comment on a thread as the given user."""
    client = APIClient()
    client.force_login(user)
    return client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/{thread.id!s}/comments/",
        {"body": body},
    )


def _setup():
    """Return a document, a thread with a first comment and the replying user."""
    document = factories.DocumentFactory(link_reach="restricted", title="My doc")
    creator = factories.UserFactory(language="en-us")
    factories.UserDocumentAccessFactory(
        document=document, user=creator, role="commenter"
    )
    thread = factories.ThreadFactory(document=document, creator=creator)
    factories.CommentFactory(thread=thread, user=creator)
    replier = factories.UserFactory(full_name="Replying User")
    factories.UserDocumentAccessFactory(document=document, user=replier, role="editor")
    return document, thread, creator, replier


def test_api_comments_reply_notifies_participants():
    """Replying in a thread emails the participants, not the author of the reply."""
    document, thread, creator, replier = _setup()
    earlier = factories.UserFactory(language="en-us")
    factories.UserDocumentAccessFactory(document=document, user=earlier, role="editor")
    factories.CommentFactory(thread=thread, user=earlier)
    # Collaborator who did not take part in the thread
    bystander = factories.UserFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=bystander, role="editor"
    )

    response = _post_comment(replier, document, thread)

    assert response.status_code == 201
    # pylint: disable=no-member
    assert sorted(email.to[0] for email in mail.outbox) == sorted(
        [creator.email, earlier.email]
    )
    email = next(email for email in mail.outbox if email.to == [creator.email])
    assert email.subject.lower() == 'replying user replied to a comment in "my doc"'
    # The link opens the thread and scrolls to the new comment
    assert (
        f"docs/{document.id!s}/#thread={thread.id!s},comment={response.json()['id']}"
        in email.body
    )


def test_api_comments_reply_does_not_notify_on_thread_creation():
    """Creating a thread (and its first comment) does not notify anybody."""
    document = factories.DocumentFactory(link_reach="restricted")
    author = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=author, role="editor")
    other = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=other, role="editor")
    factories.ThreadFactory(document=document, creator=other)

    client = APIClient()
    client.force_login(author)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/threads/", {"body": "first"}
    )

    assert response.status_code == 201
    assert models.Comment.objects.filter(thread_id=response.json()["id"]).count() == 1
    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0


def test_api_comments_reply_nobody_to_notify():
    """Replying to your own thread notifies nobody."""
    document, thread, creator, _replier = _setup()

    response = _post_comment(creator, document, thread)

    assert response.status_code == 201
    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0


def test_api_comments_reply_skips_reader_and_user_without_access():
    """Participants who cannot see the thread anymore are not notified."""
    document, thread, creator, replier = _setup()
    reader = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=reader, role="reader")
    former = factories.UserFactory()
    factories.CommentFactory(thread=thread, user=reader)
    factories.CommentFactory(thread=thread, user=former)

    response = _post_comment(replier, document, thread)

    assert response.status_code == 201
    # pylint: disable=no-member
    assert [email.to for email in mail.outbox] == [[creator.email]]


def test_api_comments_reply_with_mention_sends_a_single_email():
    """
    A user mentioned by the replier is emailed once: by the mention
    notification, not again by the reply notification.
    """
    document, thread, creator, replier = _setup()
    mentioned = factories.UserFactory()
    factories.UserDocumentAccessFactory(
        document=document, user=mentioned, role="commenter"
    )
    factories.CommentFactory(thread=thread, user=mentioned)

    client = APIClient()
    client.force_login(replier)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {
            "anchor_id": "3f2b0f4e-5c55-4f0b-9a3e-2d1f5c1b0a11",
            "mentioned_user_id": str(mentioned.id),
            "thread_id": str(thread.id),
        },
    )
    assert response.status_code == 201

    response = _post_comment(replier, document, thread)

    assert response.status_code == 201
    # pylint: disable=no-member
    recipients = [email.to[0] for email in mail.outbox]
    assert sorted(recipients) == sorted([mentioned.email, creator.email])
    assert recipients.count(mentioned.email) == 1


def test_api_comments_reply_notification_is_asynchronous():
    """The notification is queued, the request does not wait for the emails."""
    document, thread, _creator, replier = _setup()

    with mock.patch(
        "core.api.viewsets.send_thread_reply_notification_mail.delay"
    ) as mock_delay:
        response = _post_comment(replier, document, thread)

    assert response.status_code == 201
    mock_delay.assert_called_once_with(response.json()["id"])
    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0


def test_api_comments_reply_queue_failure_does_not_fail_the_creation():
    """A broker outage must not turn the creation of a comment into an error."""
    document, thread, _creator, replier = _setup()

    with mock.patch(
        "core.api.viewsets.send_thread_reply_notification_mail.delay",
        side_effect=ConnectionError("broker down"),
    ):
        response = _post_comment(replier, document, thread)

    assert response.status_code == 201
    assert models.Comment.objects.filter(id=response.json()["id"]).exists()


def test_api_comments_reply_mail_failure_does_not_fail_the_creation():
    """A failure while sending an email must not fail the creation of a comment."""
    document, thread, _creator, replier = _setup()

    with mock.patch.object(models.Document, "send_email", side_effect=RuntimeError):
        response = _post_comment(replier, document, thread)

    assert response.status_code == 201
    assert models.Comment.objects.filter(id=response.json()["id"]).exists()


def test_tasks_send_thread_reply_notification_mail():
    """The task emails the participants of the thread of the comment."""
    document, thread, creator, replier = _setup()
    reply = factories.CommentFactory(thread=thread, user=replier)

    send_thread_reply_notification_mail(str(reply.id))

    # pylint: disable=no-member
    assert [email.to for email in mail.outbox] == [[creator.email]]
    assert document.title.lower() in mail.outbox[0].subject.lower()


def test_tasks_send_thread_reply_notification_mail_deleted_comment():
    """The task does nothing if the comment was deleted in the meantime."""
    _document, thread, _creator, replier = _setup()
    reply = factories.CommentFactory(thread=thread, user=replier)
    comment_id = str(reply.id)
    reply.delete()

    send_thread_reply_notification_mail(comment_id)

    # pylint: disable-next=no-member
    assert len(mail.outbox) == 0
