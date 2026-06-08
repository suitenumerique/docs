"""
Root pytest configuration for the backend test suite.

Automatically cleans up the objects created in the MinIO/S3 bucket during a test
session, while preserving any object that already existed before the session
started (e.g. data created by the local development environment, which shares
the same ``data/media`` MinIO volume).

Why this is needed
------------------
The test bucket (``impress-media-storage``) has versioning enabled, so deleting
an object only adds a *delete marker* and keeps every previous version on disk.
Tests also create objects through several code paths (``default_storage.save``,
raw ``client.put_object`` / ``client.upload_fileobj``), some of which never
clean up after themselves. As a result the shared ``data/media`` volume grows
without bound, one test run after another.

Strategy
--------
Rather than trying to track each individual write, we snapshot every existing
object version *before* the session starts and, once the session finishes,
permanently delete every version (and delete marker) that appeared during the
session. This reclaims the disk space taken by test objects regardless of how
they were created, and leaves pre-existing objects untouched.

xdist safety
------------
The snapshot/cleanup runs only in the main process. Under ``pytest-xdist`` the
controller takes the snapshot before the workers spawn and performs the cleanup
after every worker has finished, so concurrent workers never delete each
other's objects mid-run.

Set ``DISABLE_TEST_S3_CLEANUP=1`` to keep the created objects (e.g. to inspect
them after a run).
"""

import itertools
import logging
import os

logger = logging.getLogger(__name__)

# (key, version_id) tuples present in the bucket before the test session started.
# Populated in pytest_sessionstart, consumed in pytest_sessionfinish (main process only).
_PRE_EXISTING_OBJECTS = None


def _is_main_process(config):
    """Return True for the xdist controller or a non-xdist run (never a worker)."""
    return not hasattr(config, "workerinput")


def _cleanup_enabled():
    """Allow opting out of the cleanup through an environment variable."""
    return os.environ.get("DISABLE_TEST_S3_CLEANUP", "").lower() not in (
        "1",
        "true",
        "yes",
    )


def _get_s3_client_and_bucket():
    """
    Return ``(client, bucket_name)`` for the configured S3 storage, or
    ``(None, None)`` when the default storage is not S3-backed or unusable.
    """
    # pylint: disable=import-outside-toplevel
    from django.conf import settings  # noqa: PLC0415
    from django.core.files.storage import default_storage  # noqa: PLC0415

    # Safety net: only ever touch a bucket when a custom endpoint is configured
    # (local MinIO in dev/test). Never run against a real, remote AWS S3 bucket.
    if not getattr(settings, "AWS_S3_ENDPOINT_URL", None):
        return None, None

    bucket_name = getattr(default_storage, "bucket_name", None)
    connection = getattr(default_storage, "connection", None)
    if not bucket_name or connection is None:
        return None, None

    return connection.meta.client, bucket_name


def _list_all_versions(client, bucket_name):
    """Return a set of ``(Key, VersionId)`` for every version and delete marker."""
    objects = set()
    paginator = client.get_paginator("list_object_versions")
    for page in paginator.paginate(Bucket=bucket_name):
        for item in page.get("Versions", []):
            objects.add((item["Key"], item["VersionId"]))
        for item in page.get("DeleteMarkers", []):
            objects.add((item["Key"], item["VersionId"]))
    return objects


def pytest_sessionstart(session):
    """Snapshot existing bucket objects so we can spare them after the run."""
    global _PRE_EXISTING_OBJECTS  # pylint: disable=global-statement  # noqa: PLW0603

    if not (_is_main_process(session.config) and _cleanup_enabled()):
        return

    try:
        client, bucket_name = _get_s3_client_and_bucket()
        if client is None:
            return
        _PRE_EXISTING_OBJECTS = _list_all_versions(client, bucket_name)
        logger.info(
            "S3 test cleanup: snapshotted %d pre-existing object version(s) in %r",
            len(_PRE_EXISTING_OBJECTS),
            bucket_name,
        )
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        # MinIO may be unreachable (e.g. storage-less unit runs): disable cleanup.
        _PRE_EXISTING_OBJECTS = None
        logger.warning(
            "S3 test cleanup disabled: could not snapshot the bucket", exc_info=True
        )


def pytest_sessionfinish(session, exitstatus):  # pylint: disable=unused-argument
    """Permanently delete every object version created during the test session."""
    if _PRE_EXISTING_OBJECTS is None:
        return
    if not (_is_main_process(session.config) and _cleanup_enabled()):
        return

    try:
        client, bucket_name = _get_s3_client_and_bucket()
        if client is None:
            return

        created = _list_all_versions(client, bucket_name) - _PRE_EXISTING_OBJECTS
        if not created:
            return

        # delete_objects accepts at most 1000 keys per request.
        deleted = 0
        for batch in itertools.batched(created, n=1000, strict=False):
            objects_to_delete = [
                {"Key": key, "VersionId": version_id} for key, version_id in batch
            ]
            client.delete_objects(
                Bucket=bucket_name,
                Delete={
                    "Objects": objects_to_delete,
                    "Quiet": True,
                },
            )
            deleted += len(batch)

        logger.info(
            "S3 test cleanup: permanently deleted %d object version(s) "
            "created during the session from %r",
            deleted,
            bucket_name,
        )
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        logger.warning("S3 test cleanup failed", exc_info=True)
