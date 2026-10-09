"""Custom authentication classes for the Impress core app"""

from django.conf import settings

import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from core.services.jwt_services import JWTError
from core.services.yhub_services import YHubError, YHubService


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
            raise AuthenticationFailed("Invalid authorization header.")

        token = auth_parts[1]
        if token not in settings.SERVER_TO_SERVER_API_TOKENS:
            raise AuthenticationFailed("Invalid server-to-server token.")

        # Authentication is successful, but no user is authenticated

    def authenticate_header(self, request):
        """Return the WWW-Authenticate header value."""
        return f"{self.TOKEN_TYPE} realm='Create document server to server'"


class CollaborationServerAuthentication(BaseAuthentication):
    """
    Authenticate the collaboration server on the JWT it signs.

    The mirror of the token the backend signs to call it: the collaboration
    server holds the private key and publishes the public half on its JWKS,
    which is where we read it, and the tokens it mints live for a few minutes.
    Nothing long-lived is shared between them, and either side can roll its key
    without the other being reconfigured.
    """

    AUTH_HEADER = "Authorization"
    TOKEN_TYPE = "Bearer"  # noqa S105
    ALGORITHM = "RS256"
    # The collaboration server mints its tokens for us, and only us: a token it
    # signed for another service is refused here.
    AUDIENCE = "docs-backend"

    def authenticate(self, request):
        """
        Authenticate the request on the signature, the audience and the expiry
        of the token it carries. The key validating the signature is the one
        the collaboration server publishes for the "kid" the token names.

        Returns:
            None: If authentication is successful, no user acts behind a call
                  of the collaboration server.

        Raises:
            AuthenticationFailed: If the Authorization header is missing,
            malformed, or carries a token we cannot validate.
        """
        auth_header = request.headers.get(self.AUTH_HEADER)
        if not auth_header:
            raise AuthenticationFailed("Authorization header is missing.")

        auth_parts = auth_header.split(" ")
        if len(auth_parts) != 2 or auth_parts[0] != self.TOKEN_TYPE:
            raise AuthenticationFailed("Invalid authorization header.")

        token = auth_parts[1]
        try:
            signing_key = YHubService().jwks.get_signing_key(token)
            jwt.decode(
                token,
                signing_key.key,
                algorithms=[self.ALGORITHM],
                audience=self.AUDIENCE,
            )
        # a collaboration server we cannot reach, or one that publishes nothing
        # we can verify a token with, authenticates nobody either
        except (jwt.PyJWTError, JWTError, YHubError) as err:
            raise AuthenticationFailed("Invalid collaboration server token.") from err

        # Authentication is successful, but no user is authenticated

    def authenticate_header(self, request):
        """Return the WWW-Authenticate header value."""
        return f"{self.TOKEN_TYPE} realm='Collaboration server'"
