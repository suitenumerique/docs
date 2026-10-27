"""
Batch recovery of encrypted documents through the encryption service's maintenance
escrow, and the rotation of its copies to a new maintenance key: what the
`maintenance_export`, `maintenance_import`, `maintenance_purge_versions` and
`maintenance_rotate` commands share.

How an encrypted document is stored, which the commands follow:

- its content is the object `<id>/file`, holding the base64 of the ciphertext, whose
  plaintext is the raw Yjs update (a plain document stores that update in base64
  there); the export hands the tool the raw ciphertext, and the tool hands back the
  raw update;
- each attachment is an object `<id>/attachments/<uuid>.<ext>` holding the raw
  ciphertext, encrypted with the document's own key, and flagged `is_encrypted` in
  its metadata; the Yjs content references it by that key;
- `maintenance_wrapped_document_key` is the document key wrapped for the maintenance
  key covering the owner's organization: the only way to it without a user.

The export format and the decrypted copy it comes back as are specified by the
encryption service (its integration guide, "The encrypted export for a batch recovery").
"""

import base64
import binascii
import json
import logging
import re
from contextlib import contextmanager
from pathlib import Path

from django.core.files.storage import default_storage
from django.core.management.base import CommandError
from django.db import connection

import pycrdt
from botocore.exceptions import ClientError

from core.models import Document, MaintenanceImportUpload
from core.utils.dicts import lowercase_keys

logger = logging.getLogger(__name__)

MANIFEST_FILE = "manifest.ndjson"
OTHER_KEYS_FOLDER = "other-keys"
FINGERPRINT_PATTERN = re.compile(r"^1[0-9]{39}$")
# The PostgreSQL advisory lock `maintenance_import` and `maintenance_purge_versions`
# hold while they run ("docsmain" in ASCII).
MAINTENANCE_LOCK_ID = 0x646F63736D61696E


class MissingAttachment(Exception):
    """An attachment the document lists is not in the bucket."""


def s3():
    """The storage client and bucket every document object lives in."""
    return default_storage.connection.meta.client, default_storage.bucket_name


def read_stored_content(document):
    """
    The document's stored content, the base64 text Docs keeps, or None when it has
    none. The one place the export reads content from: should content move to the
    database, only this changes.
    """
    client, bucket = s3()

    try:
        body = client.get_object(Bucket=bucket, Key=document.file_key)["Body"]
    except ClientError as error:
        if error.response["Error"]["Code"] not in ("NoSuchKey", "404"):
            raise

        return None

    return body.read()


def is_plain_yjs(stored):
    """Whether a stored content is a plain Yjs update in base64, rather than a ciphertext."""
    try:
        pycrdt.Doc().apply_update(base64.b64decode(stored))
    except Exception:  # noqa: BLE001  # pylint: disable=broad-exception-caught
        return False

    return True


def read_manifest(folder):
    """
    The lines of the manifest at the root of a folder, in order. Refuses a folder
    without one: an archive not unzipped, or the wrong folder given.
    """
    manifest = Path(folder) / MANIFEST_FILE

    if not manifest.is_file():
        raise CommandError(f"No {MANIFEST_FILE} in {folder}.")

    lines = []

    for number, line in enumerate(
        manifest.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if not line.strip():
            continue
        try:
            lines.append(json.loads(line))
        except json.JSONDecodeError as error:
            raise CommandError(
                f"Line {number} of {MANIFEST_FILE} is not JSON ({error.msg})."
            ) from error

    return lines


def key_id_from_fingerprint(fingerprint):
    """
    The key id, in hexadecimal, of the maintenance key with this fingerprint: the 40
    digits the maintenance tool and the encryption server's startup log show, spaces
    allowed. The id is the fingerprint without its scheme digit, read as a number.
    """
    digits = "".join(fingerprint.split())

    if not FINGERPRINT_PATTERN.match(digits) or int(digits[1:]) >= 2**128:
        raise ValueError(
            "A maintenance key fingerprint is 40 digits starting with 1, as the "
            "maintenance tool and the encryption server's startup log show it."
        )

    return int(digits[1:]).to_bytes(16, "big").hex()


def maintenance_key_id(copy):
    """
    The id of the maintenance key a copy was made for, in hexadecimal (bytes 2 to
    17 of `[version][key id: 16 bytes][wrap]`), or None for no copy or a malformed one.
    """
    if not copy:
        return None

    try:
        decoded = base64.b64decode(copy)
    except binascii.Error, ValueError:
        return None

    return decoded[1:17].hex() if len(decoded) > 17 else None


def object_versions(key):
    """
    Every version of exactly this key (not of the keys it prefixes), newest first
    as the storage lists them, delete markers aside; across as many pages as it takes.
    """
    client, bucket = s3()
    paginator = client.get_paginator("list_object_versions")

    return [
        version
        for page in paginator.paginate(Bucket=bucket, Prefix=key)
        for version in page.get("Versions", [])
        if version["Key"] == key
    ]


def encrypted_versions(document, attachment_keys):
    """
    The ciphertext a batch recovery left in the bucket for a document it switched
    back to plaintext, as (key, version id, size):

    - its content's encrypted versions: under the current plaintext version (and
      any other plaintext one a rerun wrote over it), the run of versions that do
      not read as a Yjs update, down to the first that does. What lies below, the
      history from before the document was encrypted, is kept whatever it holds,
      an older encrypted run included (a document encrypted, decrypted, then
      encrypted again): nothing tells it apart from a damaged plain version;
    - its old attachment objects, the keys of `attachment_keys` under its own prefix
      that it no longer lists (the import uploaded their plaintext under new keys):
      each of their versions flagged encrypted.
    """
    client, bucket = s3()
    versions = object_versions(document.file_key)
    index = 0

    def is_plain(version):
        stored = client.get_object(
            Bucket=bucket, Key=document.file_key, VersionId=version["VersionId"]
        )

        return is_plain_yjs(stored["Body"].read())

    while index < len(versions) and is_plain(versions[index]):
        index += 1

    # A current version that is not plaintext: the content is not the import's.
    if index > 0:
        while index < len(versions) and not is_plain(versions[index]):
            version = versions[index]
            yield document.file_key, version["VersionId"], version.get("Size", 0)
            index += 1

    prefix = attachment_prefix(document)
    listed = set(document.attachments or [])

    for key in dict.fromkeys(attachment_keys):
        if not key.startswith(prefix) or key in listed:
            continue

        for version in object_versions(key):
            head = client.head_object(
                Bucket=bucket, Key=key, VersionId=version["VersionId"]
            )

            if lowercase_keys(head.get("Metadata", {})).get("is_encrypted") == "true":
                yield key, version["VersionId"], version.get("Size", 0)


def attachment_prefix(document):
    """Where a document's own attachments live in the bucket."""
    return f"{document.key_base}/attachments/"


def encrypted_attachment_keys(document):
    """
    The keys of the document's own encrypted attachments, in order, once each.
    Raises MissingAttachment when one of its own is gone from the bucket: whether it
    was encrypted can no longer be told.

    `attachments` also lists keys the document may merely reference (pasted from
    another document); those are not encrypted with this document's key, so only
    the keys under its own prefix and flagged encrypted are its attachments here.
    """
    client, bucket = s3()
    prefix = attachment_prefix(document)
    keys = []

    for key in dict.fromkeys(document.attachments or []):
        if not key.startswith(prefix):
            continue

        try:
            head = client.head_object(Bucket=bucket, Key=key)
        except ClientError as error:
            if error.response["Error"]["Code"] not in ("NoSuchKey", "404"):
                raise

            raise MissingAttachment(f"{key} is not in the bucket") from error

        if lowercase_keys(head.get("Metadata", {})).get("is_encrypted") == "true":
            keys.append(key)

    return keys


@contextmanager
def maintenance_lock():
    """
    Hold the batch recovery's advisory lock, or refuse to start. Only one command
    runs at a time, so every row of the upload journal (MaintenanceImportUpload) a
    command finds when it starts is a leftover of a run that is over.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", [MAINTENANCE_LOCK_ID])
        (acquired,) = cursor.fetchone()

    if not acquired:
        raise CommandError(
            "Another maintenance_import or maintenance_purge_versions is running: "
            "wait for it to finish."
        )

    try:
        yield
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(%s)", [MAINTENANCE_LOCK_ID])


def delete_every_version(key):
    """Delete an object for good: each of its versions and delete markers."""
    client, bucket = s3()
    paginator = client.get_paginator("list_object_versions")

    for page in paginator.paginate(Bucket=bucket, Prefix=key):
        for version in [*page.get("Versions", []), *page.get("DeleteMarkers", [])]:
            if version["Key"] == key:
                client.delete_object(
                    Bucket=bucket, Key=key, VersionId=version["VersionId"]
                )


def clean_pending_uploads():
    """
    Process the upload journal a killed import left behind, under the lock: an
    object no document lists is plaintext of a switch that never committed, deleted
    with every version; one a document lists (its switch committed, the row
    survived) is kept. Either way the row goes, unless deleting the object failed,
    for the next run to try again. Returns how many objects were deleted.
    """
    deleted = 0

    for upload in MaintenanceImportUpload.objects.order_by("created_at"):
        if not Document.objects.filter(attachments__contains=[upload.key]).exists():
            try:
                delete_every_version(upload.key)
            except ClientError:
                logger.exception("Could not delete the leftover upload %s", upload.key)
                continue

            deleted += 1

        upload.delete()

    return deleted
