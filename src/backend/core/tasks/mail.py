"""Send mail using celery task."""

from django.conf import settings

from core import models
from core.utils.analytics import PosthogEventName, posthog_capture

from impress.celery_app import app


@app.task
def send_ask_for_access_mail(ask_for_access_id):
    """Send mail using celery task."""
    # Send email to document owners/admins
    ask_for_access = models.DocumentAskForAccess.objects.get(id=ask_for_access_id)
    owner_admin_accesses = models.DocumentAccess.objects.filter(
        document=ask_for_access.document, role__in=models.PRIVILEGED_ROLES
    ).select_related("user")

    for access in owner_admin_accesses:
        if access.user and access.user.email:
            ask_for_access.send_ask_for_access_email(
                access.user.email,
                access.user.language or settings.LANGUAGE_CODE,
            )


@app.task
def send_mention_notification_mail(mention_id):
    """Notify a mentioned user by email, outside the request/response cycle."""
    mention = models.Mention.objects.select_related(
        "document", "mentioned_user", "mentioned_by_user"
    ).get(id=mention_id)

    notified = mention.notify()

    posthog_capture(
        PosthogEventName.MENTION_CREATED,
        mention.mentioned_by_user,
        {
            "mention_id": str(mention.id),
            "mentioned_user_id": str(mention.mentioned_user_id),
            "thread_id": str(mention.thread_id) if mention.thread_id else None,
            "notified": notified,
        },
        document=mention.document,
    )
