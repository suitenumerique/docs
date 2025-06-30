"""OIDC Refresh Session Middleware for the Impress core app."""

import time

from lasuite.oidc_login.middleware import RefreshOIDCAccessToken


class OIDCRefreshSessionMiddleware(RefreshOIDCAccessToken):
    """
    Customizes the process_request method to update the session's
    oidc_token_expiration field.
    """

    def process_request(self, request):
        """
        Run the base process_request method and
        update oidc_token_expiration on success.
        """
        token_expiration_delay = self.get_settings("OIDC_TOKEN_EXPIRATION")
        if super().is_expired(request) and super().process_request(request) is None:
            request.session["oidc_token_expiration"] = (
                time.time() + token_expiration_delay
            )
