"""MCP-facing API endpoints for the Docs app.

Backs the three MCP tools (`search_documents`, `read_document`, `create_document`). Rather than
subclassing/routing `DocumentViewSet` (which would also expose move/duplicate/versions/ai-*
actions), each view binds a plain `DocumentViewSet` instance to reuse its permission-checked
`get_queryset`/`get_object` — so Django's existing access rules (`DocumentPermission`,
ancestor-aware abilities) keep deciding who can see or create what.

The content of a document lives in the collaboration server (yhub), never in Django: it is
read from there, and seeded there when a document is created.
"""

from django.conf import settings
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from lasuite.oidc_resource_server.authentication import ResourceServerAuthentication
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.api.filters import ListDocumentFilter
from core.api.permissions import DocumentPermission
from core.api.throttling import DocumentThrottle
from core.api.viewsets import DocumentViewSet
from core.choices import RoleChoices
from core.models import Document, DocumentAccess
from core.services import mime_types
from core.services.converter_services import ConversionError, Converter
from core.services.yhub_services import YHubError, YHubService
from core.utils.treebeard import create_tree_node_with_retry

from .permissions import MCPResourceServerPermission
from .serializers import (
    MCPDocumentCreateSerializer,
    MCPDocumentSummarySerializer,
    MCPSearchQuerySerializer,
)

CONVERSION_FAILED = _("Could not convert document content.")
COLLABORATION_UNAVAILABLE = _("Could not reach the collaboration server.")


def _bind_document_viewset(request, *, detail, action, document_id=None):
    """Bind a real `DocumentViewSet` to `request` to reuse its queryset/permission logic."""
    view = DocumentViewSet()
    view.request = request
    view.format_kwarg = None
    view.detail = detail
    view.action = action
    view.kwargs = {"pk": str(document_id)} if document_id is not None else {}
    return view


def _error(detail, status_code, **extra):
    """Build an error response shaped like DRF's own (`detail`, plus context)."""
    return Response({"detail": detail, **extra}, status=status_code)


class MCPDocumentAPIView(APIView):
    """Authentication, permissions and throttling shared by every MCP endpoint."""

    authentication_classes = [ResourceServerAuthentication]
    permission_classes = [MCPResourceServerPermission, DocumentPermission]
    throttle_classes = [DocumentThrottle]
    throttle_scope = "document"


class MCPSearchDocumentsView(MCPDocumentAPIView):
    """`POST /api/v1.0/mcp/documents/search` — backs the `search_documents` tool."""

    def post(self, request, *args, **kwargs):
        """Return small, LLM-safe summaries of documents matching `query`."""
        params = MCPSearchQuerySerializer(data=request.data)
        params.is_valid(raise_exception=True)

        view = _bind_document_viewset(request, detail=False, action="list")
        queryset = view.get_queryset()

        filterset = ListDocumentFilter(
            data={"q": params.validated_data["query"]},
            queryset=queryset,
            request=request,
        )
        if not filterset.is_valid():
            raise DRFValidationError(filterset.errors)
        queryset = filterset.filters["q"].filter(
            queryset, filterset.form.cleaned_data["q"]
        )

        queryset = queryset.order_by("-updated_at")[: params.validated_data["limit"]]

        serializer = MCPDocumentSummarySerializer(queryset, many=True)
        return Response(serializer.data)


class MCPReadDocumentView(MCPDocumentAPIView):
    """`GET /api/v1.0/mcp/documents/<uuid:document_id>` — backs the `read_document` tool."""

    def get(self, request, document_id, *args, **kwargs):
        """Return the document's title and Markdown content, converted from Yjs."""
        view = _bind_document_viewset(
            request, detail=True, action="retrieve", document_id=document_id
        )
        document = view.get_object()

        try:
            update = YHubService(user=request.user).get_ydoc(document)
        except YHubError:
            return _error(
                COLLABORATION_UNAVAILABLE, status.HTTP_503_SERVICE_UNAVAILABLE
            )

        content_text = ""
        if update is not None:
            try:
                content_text = Converter().convert(
                    update, mime_types.YJS, mime_types.MARKDOWN
                )
            except ConversionError:
                return _error(CONVERSION_FAILED, status.HTTP_503_SERVICE_UNAVAILABLE)

        max_chars = settings.MCP_READ_CONTENT_MAX_CHARS
        truncated = len(content_text) > max_chars

        return Response(
            {
                "id": str(document.id),
                "title": document.title,
                "content": content_text[:max_chars],
                "truncated": truncated,
                "updated_at": document.updated_at,
            }
        )


class MCPCreateDocumentView(MCPDocumentAPIView):
    """`POST /api/v1.0/mcp/documents` — backs the `create_document` tool."""

    def post(self, request, *args, **kwargs):
        """Create a document, at the root or under an accessible parent."""
        serializer = MCPDocumentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        title = serializer.validated_data["title"]
        content = serializer.validated_data["content"]
        parent_id = serializer.validated_data["parent_id"]

        # Check permission on the parent (if any) before doing the costlier content
        # conversion below, so a forbidden request never reaches the y-provider service.
        parent = None
        if parent_id is not None:
            parent_view = _bind_document_viewset(
                request, detail=True, action="children", document_id=parent_id
            )
            parent = parent_view.get_object()

        update = None
        if content:
            try:
                update = Converter().convert(
                    content.encode("utf-8"), mime_types.MARKDOWN, mime_types.YJS
                )
            except ConversionError:
                return _error(CONVERSION_FAILED, status.HTTP_503_SERVICE_UNAVAILABLE)

        # The collaboration server owns the content: the document row is only
        # kept if its content could be seeded there, as the regular create does.
        try:
            with transaction.atomic():
                if parent is not None:
                    document = create_tree_node_with_retry(
                        lambda: parent.add_child(creator=request.user, title=title)
                    )
                else:
                    document = create_tree_node_with_retry(
                        lambda: Document.add_root(creator=request.user, title=title)
                    )
                    DocumentAccess.objects.create(
                        document=document, user=request.user, role=RoleChoices.OWNER
                    )
                if update is not None:
                    YHubService(user=request.user).create_ydoc(document, update)
        except YHubError:
            return _error(
                COLLABORATION_UNAVAILABLE, status.HTTP_503_SERVICE_UNAVAILABLE
            )

        return Response(
            {
                "id": str(document.id),
                "title": document.title,
                "created_at": document.created_at,
            },
            status=status.HTTP_201_CREATED,
        )
