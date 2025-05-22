"""Authentication against Docs API via user token."""

import httpx


class UserTokenAuthentication(httpx.Auth):
    """Authentication class for request made to Docs, using the user token."""

    def __init__(self, token):
        """Initialize the authentication class with the user token."""
        self.token = token

    def auth_flow(self, request):
        """Add the Authorization header to the request with the user token."""
        request.headers["Authorization"] = f"Token {self.token}"
        yield request
