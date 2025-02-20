"""
Decorators for the authentication app.

We don't want (yet) to enforce the OIDC access token to be "fresh" for all
views, so we provide a decorator to refresh the access token only when needed.
"""

from django.utils.decorators import decorator_from_middleware

from .middleware import RefreshOIDCAccessToken

refresh_oidc_access_token = decorator_from_middleware(RefreshOIDCAccessToken)
