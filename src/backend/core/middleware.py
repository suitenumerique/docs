"""Force session creation for all requests."""

from django.utils.deprecation import MiddlewareMixin


class ForceSessionMiddleware(MiddlewareMixin):
    """
    Force session creation for unauthenticated users.
    Must be used after Authentication middleware.
    """

    def process_request(self, request):
        """Force session creation for unauthenticated users."""
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
