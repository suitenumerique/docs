"""Test analytics utilities."""

import json
from unittest import mock

from django.contrib.auth.models import AnonymousUser

import pytest

from core import factories
from core.utils.analytics import PosthogEventName, posthog_capture

pytestmark = pytest.mark.django_db


def test_posthog_capture_no_posthog_key():
    """When POSTHOG_KEY is not set, posthog.capture should not be called."""
    with mock.patch("core.utils.analytics.posthog.capture") as mock_capture:
        posthog_capture(PosthogEventName.DOC_CREATED, None)
        mock_capture.assert_not_called()


def test_posthog_capture_with_user_and_document(settings):
    """posthog.capture should be called with correct args when user and document are provided."""
    settings.POSTHOG_KEY = "test-key"
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    properties = {"custom": "value"}

    with mock.patch("core.utils.analytics.posthog.capture") as mock_capture:
        posthog_capture(
            PosthogEventName.DOC_CREATED,
            user,
            properties,
            document=document,
        )
        mock_capture.assert_called_once_with(
            PosthogEventName.DOC_CREATED,
            distinct_id=user.email,
            properties={
                "custom": "value",
                "document_id": str(document.id),
                "document_title": document.title,
                "document_depth": document.depth,
                "document_path": document.path,
            },
        )


def test_posthog_capture_with_user_no_document(settings):
    """posthog.capture should be called with correct args when no document is provided."""
    settings.POSTHOG_KEY = "test-key"
    user = factories.UserFactory()
    properties = {"foo": "bar"}

    with mock.patch("core.utils.analytics.posthog.capture") as mock_capture:
        posthog_capture(PosthogEventName.DOC_DELETED, user, properties)
        mock_capture.assert_called_once_with(
            PosthogEventName.DOC_DELETED,
            distinct_id=user.email,
            properties={"foo": "bar"},
        )


def test_posthog_capture_no_user(settings):
    """When user is None, distinct_id should be None."""
    settings.POSTHOG_KEY = "test-key"
    with mock.patch("core.utils.analytics.posthog.capture") as mock_capture:
        posthog_capture(PosthogEventName.DOC_CREATED, None)
        mock_capture.assert_called_once_with(
            PosthogEventName.DOC_CREATED,
            distinct_id=None,
            properties={},
        )


def test_posthog_capture_anonymous_user(settings):
    """An anonymous user (no email attribute) should resolve to a None distinct_id."""
    settings.POSTHOG_KEY = "test-key"

    with mock.patch("core.utils.analytics.posthog.capture") as mock_capture:
        posthog_capture(PosthogEventName.DOC_AI_ACTION, AnonymousUser())
        mock_capture.assert_called_once_with(
            PosthogEventName.DOC_AI_ACTION,
            distinct_id=None,
            properties={},
        )


def test_posthog_capture_properties_are_json_serializable(settings):
    """The document properties must be JSON-serializable (document_id is a str, not a UUID)."""
    settings.POSTHOG_KEY = "test-key"
    user = factories.UserFactory()
    document = factories.DocumentFactory()

    with mock.patch("core.utils.analytics.posthog.capture") as mock_capture:
        posthog_capture(PosthogEventName.DOC_CREATED, user, document=document)

    called_properties = mock_capture.call_args[1]["properties"]
    assert isinstance(called_properties["document_id"], str)
    # Mirrors PostHog's flush: properties must serialize without raising.
    json.dumps(called_properties)


def test_posthog_capture_no_properties(settings):
    """When properties is None, it should default to an empty dict."""
    settings.POSTHOG_KEY = "test-key"
    user = factories.UserFactory()

    with mock.patch("core.utils.analytics.posthog.capture") as mock_capture:
        posthog_capture(PosthogEventName.DOC_DELETED, user, None)
        mock_capture.assert_called_once_with(
            PosthogEventName.DOC_DELETED,
            distinct_id=user.email,
            properties={},
        )


def test_posthog_capture_properties_not_mutated(settings):
    """The original properties dict should not be mutated."""
    settings.POSTHOG_KEY = "test-key"
    user = factories.UserFactory()
    document = factories.DocumentFactory()
    original_properties = {"key": "value"}

    with mock.patch("core.utils.analytics.posthog.capture") as mock_capture:
        posthog_capture(
            PosthogEventName.DOC_CREATED,
            user,
            original_properties,
            document=document,
        )
        assert original_properties == {"key": "value"}
        # Verify the merged properties were passed to posthog
        called_properties = mock_capture.call_args[1]["properties"]
        assert "document_id" in called_properties
        assert "document_id" not in original_properties
