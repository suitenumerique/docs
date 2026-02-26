"""Resource Server Viewsets for the Docs app."""

from django.conf import settings

from lasuite.oidc_resource_server.authentication import ResourceServerAuthentication

from core.api.permissions import (
    CanCreateInvitationPermission,
    DocumentPermission,
    IsSelf,
    ResourceAccessPermission,
)
from core.api.viewsets import (
    DocumentAccessViewSet,
    DocumentViewSet,
    InvitationViewset,
    UserViewSet,
)
from core.external_api.permissions import ResourceServerClientPermission

# pylint: disable=too-many-ancestors


class ResourceServerRestrictionMixin:
    """
    Mixin for Resource Server Viewsets to provide shortcut to get
    configured actions for a given resource.
    """

    def _get_resource_server_actions(self, resource_name):
        """Get resource_server_actions from settings."""
        external_api_config = settings.EXTERNAL_API.get(resource_name, {})
        return list(external_api_config.get("actions", []))


class ResourceServerDocumentViewSet(ResourceServerRestrictionMixin, DocumentViewSet):
    """Resource Server Viewset for Documents."""

    authentication_classes = [ResourceServerAuthentication]

    permission_classes = [ResourceServerClientPermission & DocumentPermission]  # type: ignore

    @property
    def resource_server_actions(self):
        """Build resource_server_actions from settings."""
        return self._get_resource_server_actions("documents")


class ResourceServerDocumentAccessViewSet(
    ResourceServerRestrictionMixin, DocumentAccessViewSet
):
    """Resource Server Viewset for DocumentAccess."""

    authentication_classes = [ResourceServerAuthentication]

    permission_classes = [ResourceServerClientPermission & ResourceAccessPermission]  # type: ignore

    @property
    def resource_server_actions(self):
        """Get resource_server_actions from settings."""
        return self._get_resource_server_actions("document_access")


class ResourceServerInvitationViewSet(
    ResourceServerRestrictionMixin, InvitationViewset
):
    """Resource Server Viewset for Invitations."""

    authentication_classes = [ResourceServerAuthentication]

    permission_classes = [
        ResourceServerClientPermission & CanCreateInvitationPermission
    ]

    @property
    def resource_server_actions(self):
        """Get resource_server_actions from settings."""
        return self._get_resource_server_actions("item_invitation")


class ResourceServerUserViewSet(ResourceServerRestrictionMixin, UserViewSet):
    """Resource Server Viewset for User."""

    authentication_classes = [ResourceServerAuthentication]

    permission_classes = [ResourceServerClientPermission & IsSelf]  # type: ignore

    @property
    def resource_server_actions(self):
        """Get resource_server_actions from settings."""
        return self._get_resource_server_actions("users")
