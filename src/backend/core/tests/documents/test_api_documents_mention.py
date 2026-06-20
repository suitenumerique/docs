"""
Tests for Documents API endpoint in impress's core app: mention
"""

import random
from datetime import timedelta

from django.core import mail
from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_api_documents_mention_anonymous():
    """Anonymous users should not be allowed to mention users on a document."""
    document = factories.DocumentFactory()
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 401
    assert models.Mention.objects.exists() is False
    assert len(mail.outbox) == 0


def test_api_documents_mention_anonymous_public_document():
    """
    Anonymous users should not be allowed to mention users, even on public
    documents with a commenter link role.
    """
    document = factories.DocumentFactory(link_reach="public", link_role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    response = APIClient().post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 401
    assert models.Mention.objects.exists() is False


def test_api_documents_mention_authenticated_no_access():
    """
    Authenticated users with no access to a restricted document should not be
    allowed to mention users on it.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 403
    assert models.Mention.objects.exists() is False


def test_api_documents_mention_authenticated_reader():
    """Users with a reader role on a document should not be allowed to mention."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="reader")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 403
    assert models.Mention.objects.exists() is False


@pytest.mark.parametrize("role", ["commenter", "editor", "administrator", "owner"])
def test_api_documents_mention_authenticated_success(role):
    """
    Users with at least a commenter role should be allowed to mention another
    collaborator; the mention is created and an email notification is sent.
    """
    user = factories.UserFactory(full_name="Mentioning User")
    document = factories.DocumentFactory(link_reach="restricted", title="My doc")
    factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    mentioned_user = factories.UserFactory(language="en-us")
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 201

    mention = models.Mention.objects.get()
    assert mention.document == document
    assert mention.anchor_id == "block-1"
    assert mention.thread is None
    assert mention.mentioned_user == mentioned_user
    assert mention.mentioned_by_user == user
    assert mention.notified_at is not None

    content = response.json()
    assert content == {
        "id": str(mention.id),
        "document_id": str(document.id),
        "anchor_id": "block-1",
        "thread_id": None,
        "mentioned_user_id": str(mentioned_user.id),
        "mentioned_by_user_id": str(user.id),
        "created_at": mention.created_at.isoformat().replace("+00:00", "Z"),
        # The email is sent asynchronously, so the create response carries no
        # notification timestamp even though the stored mention is notified.
        "notified_at": None,
    }

    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == [mentioned_user.email]
    assert "you were mentioned in the document my doc" in email.subject.lower()
    email_content = " ".join(email.body.split())
    assert "Mentioning User mentioned you in the following document" in email_content
    assert f"docs/{document.id!s}/#block-1" in email_content


def test_api_documents_mention_via_link_role():
    """
    Authenticated users allowed to comment via the document link role should be
    allowed to mention collaborators.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="public", link_role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 201
    assert len(mail.outbox) == 1


def test_api_documents_mention_missing_anchor_id():
    """The anchor_id field should be required."""
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 400
    assert response.json() == {"anchor_id": ["This field is required."]}
    assert models.Mention.objects.exists() is False


def test_api_documents_mention_unknown_user():
    """Mentioning a user that does not exist should receive a 400 error."""
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {
            "anchor_id": "block-1",
            "mentioned_user_id": "8f850ee5-86b2-4c9f-acdb-ef9ccb8a4bbc",
        },
    )

    assert response.status_code == 400
    assert "mentioned_user_id" in response.json()
    assert models.Mention.objects.exists() is False


def test_api_documents_mention_user_without_access():
    """Mentioning a user that has no access to the document should be impossible."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="public", link_role="editor")
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 400
    assert response.json() == {
        "mentioned_user_id": ["This user does not have access to the document."]
    }
    assert models.Mention.objects.exists() is False
    assert len(mail.outbox) == 0


def test_api_documents_mention_user_with_access_on_ancestor():
    """Users with access inherited from an ancestor document can be mentioned."""
    user = factories.UserFactory()
    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=parent, user=mentioned_user)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 201
    assert models.Mention.objects.count() == 1
    assert len(mail.outbox) == 1


def test_api_documents_mention_user_with_access_via_team(mock_user_teams):
    """Users with access via a team can be mentioned."""
    mock_user_teams.return_value = ["lasuite"]
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.TeamDocumentAccessFactory(document=document, team="lasuite")

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 201
    assert len(mail.outbox) == 1


def test_api_documents_mention_thread():
    """
    Mentions can be attached to a comment thread of the document, in which case
    the email notification mentions the comment.
    """
    user = factories.UserFactory(full_name="Mentioning User")
    document = factories.DocumentFactory(title="My doc")
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)
    thread = factories.ThreadFactory(document=document)

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {
            "anchor_id": "comment-1",
            "mentioned_user_id": str(mentioned_user.id),
            "thread_id": str(thread.id),
        },
    )

    assert response.status_code == 201

    mention = models.Mention.objects.get()
    assert mention.thread == thread
    assert response.json()["thread_id"] == str(thread.id)

    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert (
        "you were mentioned in a comment on the document my doc"
        in email.subject.lower()
    )
    email_content = " ".join(email.body.split())
    assert (
        "Mentioning User mentioned you in a comment on the following document"
        in email_content
    )
    assert f"docs/{document.id!s}/#comment-1" in email_content


def test_api_documents_mention_thread_other_document():
    """Mentions cannot be attached to a thread from another document."""
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)
    other_thread = factories.ThreadFactory()

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {
            "anchor_id": "comment-1",
            "mentioned_user_id": str(mentioned_user.id),
            "thread_id": str(other_thread.id),
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "thread_id": ["The thread does not belong to this document."]
    }
    assert models.Mention.objects.exists() is False


def test_api_documents_mention_cooldown_same_context():
    """
    A user mentioned several times in the same context within the cooldown
    period should be notified only once, but all mentions should be recorded.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    client = APIClient()
    client.force_login(user)
    payload = {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)}

    response = client.post(f"/api/v1.0/documents/{document.id!s}/mention/", payload)
    assert response.status_code == 201
    assert models.Mention.objects.get(anchor_id="block-1").notified_at is not None
    assert len(mail.outbox) == 1

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-2", "mentioned_user_id": str(mentioned_user.id)},
    )
    assert response.status_code == 201
    assert models.Mention.objects.get(anchor_id="block-2").notified_at is None
    assert len(mail.outbox) == 1

    assert models.Mention.objects.count() == 2


def test_api_documents_mention_cooldown_distinct_contexts():
    """
    The notification cooldown applies per context: the document body and each
    thread are separate contexts.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)
    thread1, thread2 = factories.ThreadFactory.create_batch(2, document=document)

    client = APIClient()
    client.force_login(user)

    for i, thread_id in enumerate([None, str(thread1.id), str(thread2.id)]):
        payload = {
            "anchor_id": f"block-{i}",
            "mentioned_user_id": str(mentioned_user.id),
        }
        if thread_id:
            payload["thread_id"] = thread_id
        response = client.post(f"/api/v1.0/documents/{document.id!s}/mention/", payload)
        assert response.status_code == 201
        assert (
            models.Mention.objects.get(anchor_id=f"block-{i}").notified_at is not None
        )

    assert len(mail.outbox) == 3

    # Mentioning again in one of the contexts should not send a new email
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {
            "anchor_id": "block-4",
            "mentioned_user_id": str(mentioned_user.id),
            "thread_id": str(thread1.id),
        },
    )
    assert response.status_code == 201
    assert models.Mention.objects.get(anchor_id="block-4").notified_at is None
    assert len(mail.outbox) == 3

    # The cooldown should apply per mentioned user
    other_mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=other_mentioned_user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {
            "anchor_id": "block-5",
            "mentioned_user_id": str(other_mentioned_user.id),
            "thread_id": str(thread1.id),
        },
    )
    assert response.status_code == 201
    assert models.Mention.objects.get(anchor_id="block-5").notified_at is not None
    assert len(mail.outbox) == 4


def test_api_documents_mention_cooldown_expired(settings):
    """A user mentioned again after the cooldown period should be notified again."""
    settings.MENTION_NOTIFICATION_COOLDOWN_MINUTES = random.randint(1, 120)
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )
    assert response.status_code == 201
    assert len(mail.outbox) == 1

    # Age the first mention beyond the cooldown period
    expired = timezone.now() - timedelta(
        minutes=settings.MENTION_NOTIFICATION_COOLDOWN_MINUTES + 1
    )
    models.Mention.objects.update(created_at=expired, notified_at=expired)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-2", "mentioned_user_id": str(mentioned_user.id)},
    )
    assert response.status_code == 201
    assert models.Mention.objects.get(anchor_id="block-2").notified_at is not None
    assert len(mail.outbox) == 2


def test_api_documents_mention_cooldown_only_considers_notified_mentions():
    """
    Mentions that did not trigger a notification should not be taken into
    account by the cooldown check.
    """
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)
    existing_mention = factories.MentionFactory(
        document=document,
        mentioned_user=mentioned_user,
        mentioned_by_user=user,
        notified_at=None,
    )

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 201
    new_mention = models.Mention.objects.exclude(pk=existing_mention.pk).get()
    assert new_mention.notified_at is not None
    assert len(mail.outbox) == 1


def test_api_documents_mention_soft_deleted_document():
    """Mentions should not be allowed on soft deleted documents."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)
    document.soft_delete()

    client = APIClient()
    client.force_login(user)
    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/mention/",
        {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)},
    )

    assert response.status_code == 404
    assert models.Mention.objects.exists() is False


def test_api_documents_mention_throttling(settings):
    """Mention requests should be throttled once the mention rate is exceeded."""
    current_rate = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["mention"]
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["mention"] = "3/minute"

    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    client = APIClient()
    client.force_login(user)
    payload = {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)}

    # The first three requests within the minute are allowed.
    for _i in range(3):
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/mention/", payload
        )
        assert response.status_code == 201

    # The fourth request is throttled.
    response = client.post(f"/api/v1.0/documents/{document.id!s}/mention/", payload)
    assert response.status_code == 429

    # Restore original rate
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["mention"] = current_rate


def test_api_documents_mention_throttling_y_provider_exempted(settings):
    """
    Collaboration-server requests bypass the mention throttle, just like other
    document endpoints relying on the document throttle exemption.
    """
    current_rate = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["mention"]
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["mention"] = "3/minute"
    settings.Y_PROVIDER_API_KEY = "test-y-provider-key"

    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(document=document, user=user, role="commenter")
    mentioned_user = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=document, user=mentioned_user)

    client = APIClient()
    client.force_login(user)
    payload = {"anchor_id": "block-1", "mentioned_user_id": str(mentioned_user.id)}

    # More requests than the rate allows all succeed with the y-provider key.
    for _i in range(5):
        response = client.post(
            f"/api/v1.0/documents/{document.id!s}/mention/",
            payload,
            HTTP_X_Y_PROVIDER_KEY="test-y-provider-key",
        )
        assert response.status_code == 201

    # Restore original rate
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["mention"] = current_rate
