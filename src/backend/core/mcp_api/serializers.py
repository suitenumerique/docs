"""Serializers for the MCP-facing API endpoints.

These are deliberately separate from `core.api.serializers`: the MCP tools must only ever
see small, LLM-safe fields (id, title, excerpt, updated_at, converted text content) and never
abilities, access rows, link configuration or other internal metadata.
"""

from rest_framework import serializers

from core import models


# pylint: disable=abstract-method
class MCPSearchQuerySerializer(serializers.Serializer):
    """Validate the request body of the MCP search endpoint."""

    query = serializers.CharField(required=True, allow_blank=False, max_length=512)
    limit = serializers.IntegerField(
        required=False, default=5, min_value=1, max_value=20
    )


class MCPDocumentSummarySerializer(serializers.ModelSerializer):
    """Minimal document representation returned to the `search_documents` tool."""

    children_ids = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.Document
        fields = ["id", "title", "excerpt", "updated_at", "children_ids"]
        read_only_fields = fields

    def get_children_ids(self, instance):
        """Return the IDs of the document's non-deleted children."""
        return list(
            instance.get_children()
            .filter(ancestors_deleted_at__isnull=True)
            .values_list("id", flat=True)
        )


class MCPDocumentCreateSerializer(serializers.Serializer):
    """Validate input for the `create_document` tool."""

    title = serializers.CharField(required=True, allow_blank=False, max_length=255)
    content = serializers.CharField(required=True, allow_blank=True)
    parent_id = serializers.UUIDField(required=False, allow_null=True, default=None)
