"""Force session creation for all requests."""


class ForceSessionMiddleware:
    """
    Force session creation for unauthenticated users.
    Must be used after Authentication middleware.
    """

    def __init__(self, get_response):
        """Initialize the middleware."""
        self.get_response = get_response

    def __call__(self, request):
        """Force session creation for unauthenticated users."""

        if not request.user.is_authenticated and request.session.session_key is None:
            request.session.create()

        response = self.get_response(request)
        return response
