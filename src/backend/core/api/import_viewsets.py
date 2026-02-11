"""ViewSets for import-related endpoints."""

from rest_framework import permissions, viewsets

from core import models
from core.api import serializers


class OutlineImportJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for polling Outline import job status.

    This provides a read-only endpoint for checking the status of async import jobs.
    Users can only access their own import jobs.

    Endpoints:
    - GET /api/v1.0/imports/outline/jobs/       - List user's import jobs
    - GET /api/v1.0/imports/outline/jobs/{id}/  - Get specific job status
    """

    serializer_class = serializers.OutlineImportJobSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = models.OutlineImportJob.objects.all()

    def get_queryset(self):
        """Filter to only show the authenticated user's import jobs."""
        return self.queryset.filter(user=self.request.user)
