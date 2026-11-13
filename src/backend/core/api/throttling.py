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


class AnonymousAddressThrottle(MonitoredScopedRateThrottle):
    """
    Ceiling per IP address on the anonymous requests, whatever their cookie.

    A client that drops its anonymous id cookie gets a new one, and with it an
    empty bucket: alone, the per-cookie limit does not bound a script. This
    throttle counts the anonymous requests of an address on the scope of the
    view, at API_ANONYMOUS_ADDRESS_THROTTLE_FACTOR times its rate, so that
    visitors behind a shared NAT keep working while one source stays bounded.

    It is not a throttle class of the views: AnonymousIdThrottleMixin runs it
    once the limit of the visitor has accepted the request. The address is only
    reliable when NUM_PROXIES is set.
    """

    # apart from the bucket of a client without cookie, which has another rate
    cache_format = "throttle_%(scope)s_anonymous_address_%(ident)s"

    def parse_rate(self, rate):
        """Multiply the number of requests of the scope by the factor."""
        num_requests, duration = super().parse_rate(rate)
        if num_requests is None:
            return num_requests, duration

        return (
            num_requests * settings.API_ANONYMOUS_ADDRESS_THROTTLE_FACTOR,
            duration,
        )

    def get_cache_key(self, request, view):
        """Only count anonymous requests: a user has their own bucket."""
        if request.user and request.user.is_authenticated:
            return None

        return super().get_cache_key(request, view)


class AnonymousIdThrottleMixin:
    """
    Identify an anonymous client by its anonymous id cookie.

    Anonymous visitors behind a shared NAT have the same IP address: keyed on
    it, they would share their limits. The cookie is set by
    core.middleware.AnonymousIdMiddleware. Without it, or with a forged one, the
    client is identified by its IP address as usual.

    The requests this limit accepts are then counted by AnonymousAddressThrottle,
    the ceiling of their IP address.
    """

    address_throttle = None

    def get_ident(self, request):
        """Return the anonymous id of the request, or else its IP address."""
        if anonymous_id := get_anonymous_id(request):
            return f"anonymous_{anonymous_id}"

        return super().get_ident(request)

    def allow_request(self, request, view):
        """
        Check the ceiling of the address once the visitor is within their limit.

        Not as a second throttle class: DRF runs them all, so the requests
        refused to one visitor would use up the ceiling of the whole address.
        """
        self.address_throttle = None
        if not super().allow_request(request, view):
            return False

        address_throttle = AnonymousAddressThrottle()
        if address_throttle.allow_request(request, view):
            return True

        # refused: it must not use up the limit of the visitor either
        self.history.pop(0)
        self.cache.set(self.key, self.history, self.duration)
        self.address_throttle = address_throttle
        return False

    def wait(self):
        """Return the delay of the limit that refused the request."""
        if self.address_throttle is not None:
            return self.address_throttle.wait()

        return super().wait()


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
