"""Permissions for the MCP-facing API endpoints."""

from django.conf import settings

from lasuite.oidc_resource_server.authentication import ResourceServerAuthentication
from rest_framework import permissions


class MCPResourceServerPermission(permissions.BasePermission):
    """
    Require a resource-server access token whose origin client is allow-listed.

    Mirrors `core.external_api.permissions.ResourceServerClientPermission`: the MCP server
    forwards the caller's own Keycloak access token unchanged, Django introspects it, and the
    token's origin client (`request.resource_server_token_audience`, the introspection
    `client_id` by default) must be in `OIDC_RS_ALLOWED_AUDIENCES` — i.e. `docs-mcp-client`.
    """

    def has_permission(self, request, view):
        """Check that authentication succeeded via the resource server with the right audience."""
        if not isinstance(
            request.successful_authenticator, ResourceServerAuthentication
        ):
            return False

        if not request.user.is_authenticated:
            return False

        return (
            request.resource_server_token_audience in settings.OIDC_RS_ALLOWED_AUDIENCES
        )
