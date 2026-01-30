"""Import endpoints for Outline (zip upload)."""

from __future__ import annotations

import uuid

from django.core.files.storage import default_storage
from django.db import transaction
from django.urls import reverse

import rest_framework as drf
from lasuite.malware_detection import malware_detection

from core import models
from core.api.serializers import OutlineImportSerializer

# ---------- Outline (Zip Upload) ----------


class OutlineImportUploadView(drf.views.APIView):
    """
    Upload an Outline export zip file for asynchronous processing.

    This endpoint:
    1. Validates the uploaded zip file
    2. Saves it to S3 storage
    3. Creates an OutlineImportJob to track the import
    4. Triggers malware scanning of the zip
    5. Returns a polling URL for checking import status

    The actual import processing happens asynchronously after malware scanning.
    """

    authentication_classes = [drf.authentication.SessionAuthentication]
    parser_classes = [drf.parsers.MultiPartParser]
    permission_classes = [drf.permissions.IsAuthenticated]

    def post(self, request):
        # Validate the uploaded file
        serializer = OutlineImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]

        # Generate S3 key for the zip file
        file_id = uuid.uuid4()
        key = f"imports/outline/{request.user.id}/{file_id}.zip"

        # Save the zip file to S3
        default_storage.save(key, uploaded_file)

        # Create import job and trigger malware scan in a transaction
        with transaction.atomic():
            job = models.OutlineImportJob.objects.create(
                user=request.user,
                zip_file_key=key,
                status=models.OutlineImportJob.Status.PENDING,
            )

            # Trigger malware scan of the zip file
            # The callback will trigger the import task if the file is safe
            transaction.on_commit(
                lambda: malware_detection.analyse_file(key, import_job_id=str(job.id))
            )

        # Return job info and polling URL
        status_url = reverse("outline-import-job-detail", kwargs={"pk": job.id})

        return drf.response.Response(
            {
                "job_id": str(job.id),
                "status": job.status,
                "status_url": request.build_absolute_uri(status_url),
            },
            status=drf.status.HTTP_202_ACCEPTED,  # 202 Accepted for async processing
        )
