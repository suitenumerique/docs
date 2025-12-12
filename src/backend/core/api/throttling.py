"""Throttling modules for the API."""

from django.conf import settings

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


class DocumentThrottle(MonitoredScopedRateThrottle):
    """
    Throttle for document-related endpoints, with an exception for requests from the
    collaboration server.
    """

    scope = "document"

    def allow_request(self, request, view):
        """
        Override to skip throttling for requests from the collaboration server.

        Verifies the X-Y-Provider-Key header contains a valid Y_PROVIDER_API_KEY.
        Using a custom header instead of Authorization to avoid triggering
        authentication middleware.
        """

        y_provider_header = request.headers.get("X-Y-Provider-Key", "")

        # Check if this is a valid y-provider request and exempt from throttling
        y_provider_key = getattr(settings, "Y_PROVIDER_API_KEY", None)
        if y_provider_key and y_provider_header == y_provider_key:
            return True

        return super().allow_request(request, view)
