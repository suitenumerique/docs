"""Throttling modules for the API."""

from django.conf import settings
from django.utils.crypto import constant_time_compare

from lasuite.drf.throttling import MonitoredScopedRateThrottle
from rest_framework.throttling import UserRateThrottle
from sentry_sdk import capture_message


def sentry_monitoring_throttle_failure(message):
    """Log when a failure occurs to detect rate limiting issues."""
    capture_message(message, "warning")


class UserListThrottleBurst(UserRateThrottle):
    """Throttle for the user list endpoint."""

    scope = "user_list_burst"


class UserListThrottleSustained(UserRateThrottle):
    """Throttle for the user list endpoint."""

    scope = "user_list_sustained"


class YProviderThrottleMixin:
    """Skip throttling for requests from the collaboration server."""

    def allow_request(self, request, view):
        """Skip throttling when the X-Y-Provider-Key header carries the shared key."""
        if (
            y_provider_key := getattr(settings, "Y_PROVIDER_API_KEY", None)
        ) and constant_time_compare(
            request.headers.get("X-Y-Provider-Key", ""), y_provider_key
        ):
            return True

        return super().allow_request(request, view)


class DocumentThrottle(YProviderThrottleMixin, MonitoredScopedRateThrottle):
    """Throttle for document-related endpoints, except collaboration-server requests."""

    scope = "document"


class DocumentAccessThrottle(YProviderThrottleMixin, MonitoredScopedRateThrottle):
    """Throttle for document access endpoints, except collaboration-server requests."""

    scope = "document_access"
