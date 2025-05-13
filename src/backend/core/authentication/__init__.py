"""Custom authentication classes for the Impress core app"""

from django.conf import settings

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class AuthenticatedServer:
    """
    Simple class to represent an authenticated server to be used along the
    IsAuthenticated permission.
    """

    is_authenticated = True


class ServerToServerAuthentication(BaseAuthentication):
    """
    Custom authentication class for server-to-server requests.
    Validates the presence and correctness of the Authorization header.
    """

    AUTH_HEADER = "Authorization"
    TOKEN_TYPE = "Bearer"  # noqa S105

    def authenticate(self, request):
        """
        Authenticate the server-to-server request by validating the Authorization header.

        This method checks if the Authorization header is present in the request, ensures it
        contains a valid token with the correct format, and verifies the token against the
        list of allowed server-to-server tokens. If the header is missing, improperly formatted,
        or contains an invalid token, an AuthenticationFailed exception is raised.

        Returns:
            None: If authentication is successful
                  (no user is authenticated for server-to-server requests).

        Raises:
            AuthenticationFailed: If the Authorization header is missing, malformed,
            or contains an invalid token.
        """
        auth_header = request.headers.get(self.AUTH_HEADER)
        if not auth_header:
            raise AuthenticationFailed("Authorization header is missing.")

        # Validate token format and existence
        auth_parts = auth_header.split(" ")
        if len(auth_parts) != 2 or auth_parts[0] != self.TOKEN_TYPE:
            # Do not raise here to leave the door open for other authentication methods
            return None

        token = auth_parts[1]
        if token not in settings.SERVER_TO_SERVER_API_TOKENS:
            # Do not raise here to leave the door open for other authentication methods
            return None

        # Authentication is successful
        return AuthenticatedServer(), token

    def authenticate_header(self, request):
        """Return the WWW-Authenticate header value."""
        return f"{self.TOKEN_TYPE} realm='Create document server to server'"
