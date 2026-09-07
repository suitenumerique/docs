"""Force session creation for all requests."""

from django.utils.deprecation import MiddlewareMixin

# Paths that must never touch the session store. The liveness probe is called
# by the kubelet every few seconds and has to keep answering even when the
# session backend (Redis) is slow or down, otherwise every backend container
# gets killed and restarted in a loop as soon as Redis hangs.
SESSION_EXEMPT_PATHS = ("/__lbheartbeat__",)


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
