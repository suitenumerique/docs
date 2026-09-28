"""Resource Server Permissions for the Docs app."""

from django.conf import settings

from lasuite.oidc_resource_server.authentication import ResourceServerAuthentication
from rest_framework import permissions


class ResourceServerClientPermission(permissions.BasePermission):
    """
    Permission class for resource server views.
    This provides a way to open the resource server views to a limited set of
    Service Providers.
    Note: we might add a more complex permission system in the future, based on
    the Service Provider ID and the requested scopes.
    """

    def has_permission(self, request, view):
        """
        Check if the user is authenticated and the token introspection
        provides an authorized Service Provider.
        """
        if not isinstance(
            request.successful_authenticator, ResourceServerAuthentication
        ):
            # Not a resource server request
            return False

        # Check if the user is authenticated
        if not request.user.is_authenticated:
            return False
        if (
            hasattr(view, "resource_server_actions")
            and view.action not in view.resource_server_actions
        ):
            return False

        # When used as a resource server, the request has a token audience
        return (
            request.resource_server_token_audience in settings.OIDC_RS_ALLOWED_AUDIENCES
        )
