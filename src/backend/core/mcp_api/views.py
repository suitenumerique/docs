"""MCP-facing API endpoints for the Docs app.

Backs the three MCP tools (`search_documents`, `read_document`, `create_document`). Rather than
subclassing/routing `DocumentViewSet` (which would also expose move/duplicate/versions/ai-*
actions), each view binds a plain `DocumentViewSet` instance to reuse its permission-checked
`get_queryset`/`get_object` — so Django's existing access rules (`DocumentPermission`,
ancestor-aware abilities) keep deciding who can see or create what.
"""

import base64

from django.conf import settings
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
from core.utils.treebeard import create_tree_node_with_retry

from .permissions import MCPResourceServerPermission
from .serializers import (
    MCPDocumentCreateSerializer,
    MCPDocumentSummarySerializer,
    MCPSearchQuerySerializer,
)


def _bind_document_viewset(request, *, detail, action, document_id=None):
    """Bind a real `DocumentViewSet` to `request` to reuse its queryset/permission logic."""
    view = DocumentViewSet()
    view.request = request
    view.format_kwarg = None
    view.detail = detail
    view.action = action
    view.kwargs = {"pk": str(document_id)} if document_id is not None else {}
    return view


class MCPSearchDocumentsView(APIView):
    """`POST /api/v1.0/mcp/documents/search` — backs the `search_documents` tool."""

    authentication_classes = [ResourceServerAuthentication]
    permission_classes = [MCPResourceServerPermission, DocumentPermission]
    throttle_classes = [DocumentThrottle]
    throttle_scope = "document"

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


class MCPReadDocumentView(APIView):
    """`GET /api/v1.0/mcp/documents/<uuid:document_id>` — backs the `read_document` tool."""

    authentication_classes = [ResourceServerAuthentication]
    permission_classes = [MCPResourceServerPermission, DocumentPermission]
    throttle_classes = [DocumentThrottle]
    throttle_scope = "document"

    def get(self, request, document_id, *args, **kwargs):
        """Return the document's title and Markdown content, converted from Yjs."""
        view = _bind_document_viewset(
            request, detail=True, action="retrieve", document_id=document_id
        )
        document = view.get_object()

        content_text = ""
        if document.content:
            try:
                content_text = Converter().ydoc.convert(
                    data=base64.b64decode(document.content),
                    content_type=mime_types.YJS,
                    accept=mime_types.MARKDOWN,
                )
            except ConversionError:
                return Response(
                    {"detail": _("Could not convert document content.")},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

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


class MCPCreateDocumentView(APIView):
    """`POST /api/v1.0/mcp/documents` — backs the `create_document` tool."""

    authentication_classes = [ResourceServerAuthentication]
    permission_classes = [MCPResourceServerPermission, DocumentPermission]
    throttle_classes = [DocumentThrottle]
    throttle_scope = "document"

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

        try:
            content_b64 = Converter().ydoc.convert(
                data=content.encode("utf-8"),
                content_type=mime_types.MARKDOWN,
                accept=mime_types.YJS,
            )
        except ConversionError:
            return Response(
                {"detail": _("Could not convert document content.")},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if parent is not None:
            document = create_tree_node_with_retry(
                lambda: parent.add_child(
                    creator=request.user, title=title, content=content_b64
                )
            )
        else:
            document = create_tree_node_with_retry(
                lambda: Document.add_root(
                    creator=request.user, title=title, content=content_b64
                )
            )
            DocumentAccess.objects.create(
                document=document, user=request.user, role=RoleChoices.OWNER
            )

        return Response(
            {
                "id": str(document.id),
                "title": document.title,
                "created_at": document.created_at,
            },
            status=status.HTTP_201_CREATED,
        )
