"""Celery task for processing Outline imports."""

import io
import logging

from django.core.files.storage import default_storage
from django.db import transaction

from core import models
from core.services.outline_import import process_outline_zip

from impress.celery_app import app

logger = logging.getLogger(__name__)


@app.task
def process_outline_import_task(job_id):
    """
    Process an Outline import job asynchronously.

    This task is triggered after the uploaded zip file has been scanned for malware
    and deemed safe. It downloads the zip from S3, processes it to create documents,
    and updates the job status accordingly.

    Args:
        job_id: UUID of the OutlineImportJob to process
    """
    try:
        job = models.OutlineImportJob.objects.get(id=job_id)
    except models.OutlineImportJob.DoesNotExist:
        logger.error("OutlineImportJob %s not found", job_id)
        return

    logger.info("Starting Outline import job %s", job_id)
    job.status = models.OutlineImportJob.Status.PROCESSING
    job.save(update_fields=["status", "updated_at"])

    try:
        # Download zip file from S3
        logger.debug("Downloading zip file from S3: %s", job.zip_file_key)
        try:
            zip_file = default_storage.open(job.zip_file_key, "rb")
            zip_bytes = zip_file.read()
            zip_file.close()
        except Exception as e:
            raise Exception(f"Failed to download zip file from S3: {e}") from e

        # Process the zip file within an atomic transaction
        # If any error occurs, all database changes will be rolled back
        with transaction.atomic():
            created_ids = process_outline_zip(job.user, zip_bytes)
            job.created_document_ids = created_ids
            job.status = models.OutlineImportJob.Status.COMPLETED
            job.save(update_fields=["created_document_ids", "status", "updated_at"])

        logger.info(
            "Outline import job %s completed successfully. Created %d documents.",
            job_id,
            len(created_ids),
        )

        # Delete the zip file from S3 after successful import
        try:
            default_storage.delete(job.zip_file_key)
            logger.debug("Deleted zip file from S3: %s", job.zip_file_key)
        except Exception as e:
            logger.warning("Failed to delete zip file %s: %s", job.zip_file_key, e)

    except Exception as e:
        logger.exception("Outline import job %s failed: %s", job_id, str(e))
        job.status = models.OutlineImportJob.Status.FAILED
        job.error_message = str(e)
        job.save(update_fields=["status", "error_message", "updated_at"])
        # Keep the zip file in S3 for debugging purposes when import fails
