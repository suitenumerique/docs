"""API liveness and readiness probes for Impress' core application."""

import uuid

from django.core.cache import CacheKeyWarning, cache
from django.core.exceptions import SuspiciousFileOperation
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse

import requests
from botocore.exceptions import BotoCoreError, ClientError


def liveness_check(request):
    """
    Liveness probe endpoint.
    Returns HTTP 200 if the application is alive and running.
    """

    return JsonResponse({"status": "OK"}, status=200)


def readiness_check(request):
    """
    Readiness probe endpoint.
    Checks database, cache, media storage, and OIDC configuration.
    Returns HTTP 200 with JSON status "OK" if all checks pass,
    or HTTP 500 with JSON status "Error" and an error message.
    """

    def check_database():
        """Check database connectivity."""
        try:
            db_conn = connections["default"]
            db_conn.cursor()
        except OperationalError as e:
            raise RuntimeError(
                "Database connectivity check failed."
                "Please verify your database configuration and status."
            ) from e

    def check_cache():
        """Check cache connectivity."""
        test_key = "readiness-probe"
        test_value = "ready"
        cache.set(test_key, test_value, timeout=5)
        if cache.get(test_key) != test_value:
            raise RuntimeError(
                "Cache check failed: Value mismatch or cache unavailable."
            )

    def check_media_storage():
        """Check S3 storage connectivity by attempting to write and delete a test file."""
        test_file_name = f"readiness-check-{uuid.uuid4()}.txt"
        test_content = ContentFile(b"readiness check")

        try:
            # Attempt to save the test file
            default_storage.save(test_file_name, test_content)
            # Attempt to delete the test file
            default_storage.delete(test_file_name)
        except (SuspiciousFileOperation, OSError, BotoCoreError, ClientError) as e:
            # Re-raise with context from the original exception
            raise RuntimeError("Media storage check failed.") from e

    try:
        # Run all checks
        check_database()
        check_cache()
        check_media_storage()

        # If all checks pass
        return JsonResponse({"status": "OK"}, status=200)

    except (
        OperationalError,
        CacheKeyWarning,
        BotoCoreError,
        ClientError,
        requests.RequestException,
    ) as e:
        return JsonResponse({"status": "Error", "message": str(e)}, status=500)
