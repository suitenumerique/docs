"""
PostHog utilities
"""

from enum import StrEnum

from django.conf import settings

import posthog

from core.models import User


class PosthogEventName(StrEnum):
    """Posthog event name enum"""

    # Document
    DOC_CREATED = "doc_created"
    DOC_DELETED = "doc_deleted"
    DOC_DUPLICATED = "doc_duplicated"
    DOC_IMPORTED = "doc_imported"
    DOC_FAVORITED = "doc_favorited"
    DOC_AI_ACTION = "doc_ai_action"
    DOC_MOVED = "doc_moved"
    DOC_LEFT = "doc_left"

    # DocumentAccess
    DOC_ACCESS_CREATED = "doc_access_created"
    DOC_ACCESS_DELETED = "doc_access_deleted"

    # Thread
    THREAD_CREATED = "thread_created"

    # Comment
    COMMENT_CREATED = "comment_created"

    # User
    USER_LOGIN = "user_login"


def posthog_capture(
    event_name: PosthogEventName,
    user: User | None,
    properties: dict | None = None,
    **kwargs,
):
    """Capture an event with PostHog."""
    if settings.POSTHOG_KEY:
        if properties is None:
            properties = {}

        properties = properties.copy()
        document = kwargs.get("document")
        if document:
            properties.update(
                {
                    "document_id": str(document.id),
                    "document_title": document.title,
                    "document_depth": document.depth,
                    "document_path": document.path,
                }
            )
        posthog.capture(
            event_name,
            distinct_id=getattr(user, "email", None),
            properties=properties,
        )
