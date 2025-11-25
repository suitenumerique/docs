"""Custom system checks (used by dockerflow and management commands)."""

import uuid

from botocore.exceptions import BotoCoreError, ClientError
from django.core.cache import CacheKeyWarning, cache
from django.core.checks import Error, register
from django.core.exceptions import SuspiciousFileOperation
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import connections
from django.db.utils import OperationalError


@register()
def database_check(app_configs, **kwargs):
    """Ensure the default database is reachable."""
    errors = []
    try:
        db_conn = connections["default"]
        db_conn.cursor()
    except OperationalError as exc:
        errors.append(
            Error(
                "Database connectivity check failed.",
                hint="Verify database configuration and availability.",
                obj="database",
                id="core.E001",
            )
        )
    return errors


@register()
def cache_check(app_configs, **kwargs):
    """Ensure the cache can set/get values."""
    errors = []
    test_key = "readiness-probe"
    test_value = "ready"
    try:
        cache.set(test_key, test_value, timeout=5)
        if cache.get(test_key) != test_value:
            errors.append(
                Error(
                    "Cache check failed: Value mismatch or cache unavailable.",
                    obj="cache",
                    id="core.E002",
                )
            )
    except CacheKeyWarning:
        errors.append(
            Error(
                "Cache key warning encountered during cache check.",
                obj="cache",
                id="core.E003",
            )
        )
    return errors


@register()
def media_storage_check(app_configs, **kwargs):
    """Ensure media storage can write/delete a file."""
    errors = []
    test_file_name = f"readiness-check-{uuid.uuid4()}.txt"
    test_content = ContentFile(b"readiness check")
    try:
        default_storage.save(test_file_name, test_content)
        default_storage.delete(test_file_name)
    except (SuspiciousFileOperation, OSError, BotoCoreError, ClientError) as exc:
        errors.append(
            Error(
                "Media storage check failed.",
                hint=str(exc),
                obj="storage",
                id="core.E004",
            )
        )
    return errors
