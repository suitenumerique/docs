"""Throttling modules for the API."""

from django.conf import settings
from django.utils.crypto import constant_time_compare

from lasuite.drf.throttling import MonitoredScopedRateThrottle
from rest_framework.throttling import UserRateThrottle
from sentry_sdk import capture_message

from core.middleware import get_anonymous_id


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


class AnonymousIdThrottleMixin:
    """
    Identify an anonymous client by its anonymous id cookie.

    Anonymous visitors behind a shared NAT have the same IP address: keyed on
    it, they would share their limits. The cookie is set by
    core.middleware.AnonymousIdMiddleware. Without it, or with a forged one, the
    client is identified by its IP address as usual.
    """

    def get_ident(self, request):
        """Return the anonymous id of the request, or else its IP address."""
        if anonymous_id := get_anonymous_id(request):
            return f"anonymous_{anonymous_id}"

        return super().get_ident(request)


class DocumentThrottle(
    YProviderThrottleMixin, AnonymousIdThrottleMixin, MonitoredScopedRateThrottle
):
    """
    Throttle for document-related endpoints, except collaboration-server requests.

    The scope, and so the rate and the cache key, come from the view's
    `throttle_scope`: a view without one is not throttled.
    """


class DocumentAccessThrottle(
    YProviderThrottleMixin, AnonymousIdThrottleMixin, MonitoredScopedRateThrottle
):
    """
    Throttle for document access endpoints, except collaboration-server requests.

    The scope, and so the rate and the cache key, come from the view's
    `throttle_scope`: a view without one is not throttled.
    """
