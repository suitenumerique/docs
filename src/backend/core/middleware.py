"""Custom middlewares of the impress core application."""

from secrets import compare_digest

from django.conf import settings
from django.http import HttpResponse
from django.utils.deprecation import MiddlewareMixin

# Where the Prometheus metrics are served when PROMETHEUS_METRICS_ENABLED is set.
# Defined here rather than next to the view so that this module, which is always
# loaded, does not import prometheus_client when the metrics are disabled.
METRICS_PATH = "/metrics"

# Paths that must never touch the session store. Liveness and readiness
# probes should never create a new session in redis. Also, the liveness probe
# should never reach redis before returning its answer. A scraper carries no
# cookie either: each of its calls would leave one more session behind.
SESSION_EXEMPT_PATHS = (
    "/__lbheartbeat__",
    "/__heartbeat__",
    METRICS_PATH,
)


class ForceSessionMiddleware(MiddlewareMixin):
    """
    Force session creation for unauthenticated users.
    Must be used after Authentication middleware.
    """

    def process_request(self, request):
        """Force session creation for unauthenticated users."""
        # Check the path before touching `request.user`: evaluating it loads
        # the session from the cache backend.
        if request.path.rstrip("/") in SESSION_EXEMPT_PATHS:
            return

        if not request.user.is_authenticated and request.session.session_key is None:
            request.session.create()


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
