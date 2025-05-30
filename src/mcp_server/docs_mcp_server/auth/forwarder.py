"""Authentication against Docs API via user token."""

import httpx
from fastmcp.server.dependencies import get_http_request


class HeaderForwarderAuthentication(httpx.Auth):
    """Authentication class for request made to Docs, work as boilerplate."""

    def auth_flow(self, request):
        """Get Authorization header from request and pass it to the client."""
        _incoming_request = get_http_request()

        # Get authorization header
        auth_header = _incoming_request.headers.get("authorization", "")

        request.headers["Authorization"] = auth_header
        yield request
