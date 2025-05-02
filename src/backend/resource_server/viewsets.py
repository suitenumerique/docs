
from lasuite.oidc_resource_server.mixins import ResourceServerMixin

from core.api.viewsets import DocumentViewSet


class RSDocumentViewSet(ResourceServerMixin, DocumentViewSet):
    """
    ViewSet for the resource server document API.

    Exposes the same endpoints as the main document API, as resource server.
    """
