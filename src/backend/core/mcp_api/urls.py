"""URL configuration for the MCP-facing API endpoints."""

from django.urls import path

from . import views

urlpatterns = [
    path("mcp/documents/search", views.MCPSearchDocumentsView.as_view()),
    path("mcp/documents", views.MCPCreateDocumentView.as_view()),
    path(
        "mcp/documents/<uuid:document_id>",
        views.MCPReadDocumentView.as_view(),
    ),
]
