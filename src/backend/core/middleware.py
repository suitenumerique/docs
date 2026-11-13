"""Custom middlewares of the impress core app."""

import uuid
from secrets import compare_digest

from django.conf import settings
from django.http import HttpResponse
from django.utils.deprecation import MiddlewareMixin

# Where the Prometheus metrics are served when PROMETHEUS_METRICS_ENABLED is set.
# Defined here rather than next to the view so that this module, which is always
# loaded, does not import prometheus_client when the metrics are disabled.
METRICS_PATH = "/metrics"

# Salt of the anonymous id cookie signature, so that a value signed with the
# same secret key for another purpose is not accepted as an anonymous id.
ANONYMOUS_ID_COOKIE_SALT = "core.middleware.AnonymousIdMiddleware"


def get_anonymous_id(request):
    """
    Return the id carried by the anonymous id cookie of the request, or None
    when the cookie is missing or its signature is not valid.
    """
    return request.get_signed_cookie(
        settings.ANONYMOUS_ID_COOKIE_NAME,
        default=None,
        salt=ANONYMOUS_ID_COOKIE_SALT,
    )


class AnonymousIdMiddleware(MiddlewareMixin):
    """
    Give each anonymous visitor a signed cookie holding a random id.

    The throttles key an anonymous request on this id rather than on its IP
    address, so that visitors behind a shared NAT do not share their limits
    (see core.api.throttling.AnonymousIdThrottleMixin). The id is not stored in
    the session: anonymous visitors have none. Installed after the
    authentication middleware, which tells whether the visitor is logged in.

    Only API responses carry it: the throttles only apply there, and other
    callers (the metrics scraper, the admin...) have no use for it.
    """

    def process_response(self, request, response):
        """Set the cookie on an API response to an anonymous visitor without one."""
        if not request.path_info.startswith("/api/"):
            return response

        user = getattr(request, "user", None)
        if user is None or user.is_authenticated or get_anonymous_id(request):
            return response

        response.set_signed_cookie(
            settings.ANONYMOUS_ID_COOKIE_NAME,
            uuid.uuid4().hex,
            salt=ANONYMOUS_ID_COOKIE_SALT,
            httponly=True,
            secure=True,
            samesite="Lax",
        )
        return response


class SaveRawBodyMiddleware(MiddlewareMixin):
    """
    Save the raw request body to use it later.
    """

    def process_request(self, request):
        """Save the raw request body in the request to use it later."""
        if request.path.endswith(("/ai-proxy/", "/ai-proxy")):
            request.raw_body = request.body


class PrometheusAuthMiddleware(MiddlewareMixin):
    """
    Require PROMETHEUS_API_KEY as a bearer token on the metrics endpoint.

    Installed first, and only when PROMETHEUS_METRICS_ENABLED is set. It fails
    closed: with no key configured nothing is served, whatever is presented.
    """

    def process_request(self, request):
        """Refuse a call to the metrics endpoint that does not present the key."""
        if request.path.rstrip("/") != METRICS_PATH:
            return None

        api_key = settings.PROMETHEUS_API_KEY
        authorization = request.headers.get("Authorization") or ""
        # compared as bytes: `compare_digest` refuses non-ASCII strings, and
        # what a caller sends in a header is not ours to trust
        if not api_key or not compare_digest(
            authorization.encode(), f"Bearer {api_key}".encode()
        ):
            response = HttpResponse("Unauthorized", status=401)
            response["WWW-Authenticate"] = 'Bearer realm="metrics"'
            return response

        return None
