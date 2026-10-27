"""
Write back a batch recovery: the decrypted copy the encryption service's
maintenance tool produced from `maintenance_export`, as a folder (the archive
unzipped, or the folder the tool wrote). Each document goes back to plaintext on its
own, whole or not at all, and only if nobody edited it since the export.

For each document, its decrypted attachments are first uploaded under new keys, as
the upload endpoint stores any attachment, and its content is rewritten to name
them. Then one short transaction checks the row is still unchanged, points it at
the new keys, drops its keys and writes the content, last. Until that commit the
ciphertext is untouched and the document opens as before; after it, the ciphertext
stays in the bucket, out of reach, until `maintenance_purge_versions` deletes it.

Each new key is journaled (MaintenanceImportUpload) and committed before its upload,
and the switch deletes its rows: a run killed in between leaves rows naming
plaintext objects no document lists, which the next run deletes first, under an
advisory lock that keeps a second run from starting meanwhile.
"""

import base64
import logging
from collections import defaultdict
from datetime import datetime
from email.message import Message
from pathlib import Path, PurePosixPath

from django.core.cache import cache
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from botocore.exceptions import ClientError
from lasuite.malware_detection import malware_detection
from rest_framework.exceptions import ValidationError

from core import enums
from core.api.serializers import FileUploadSerializer
from core.api.utils import attachment_upload_target, get_content_metadata_cache_key
from core.models import Document, DocumentAccess, MaintenanceImportUpload
from core.utils.dicts import lowercase_keys
from core.utils.maintenance_escrow import (
    MANIFEST_FILE,
    MissingAttachment,
    attachment_prefix,
    clean_pending_uploads,
    encrypted_attachment_keys,
    is_plain_yjs,
    maintenance_lock,
    read_manifest,
    s3,
)
from core.utils.yjs import replace_attachment_keys

logger = logging.getLogger(__name__)


class Skipped(Exception):
    """A document left as it is, for a reason the summary gives."""


class Command(BaseCommand):
    """Write the decrypted documents back, in plaintext."""

    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument(
            "folder", help="The decrypted copy, with manifest.ndjson at its root."
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Check every document and say what would happen, changing nothing.",
        )

    def handle(self, *args, **options):
        folder = Path(options["folder"])
        lines = read_manifest(folder)
        still_encrypted = [
            line.get("id")
            for line in lines
            if "maintenanceKey" in line or "wrappedKey" in line
        ]

        # The tool drops both from every line it decrypts: a line still carrying
        # one is the export itself, whose files are ciphertext.
        if still_encrypted:
            raise CommandError(
                f"{len(still_encrypted)} lines of {MANIFEST_FILE} still carry a key "
                f"(maintenanceKey or wrappedKey), the first for {still_encrypted[0]}: "
                "this is the encrypted export, not the decrypted copy the maintenance "
                "tool saves. Nothing was imported."
            )

        client, bucket = s3()
        versioning = client.get_bucket_versioning(Bucket=bucket).get("Status")

        # The content goes back under its own key, `<id>/file`: only a versioned
        # bucket lets a document that fails get its ciphertext back. Docs needs
        # versioning anyway, for the document history.
        if versioning != "Enabled":
            raise CommandError(
                f"The bucket {bucket} has no versioning: Docs requires it, and the import "
                "relies on it to undo a document that fails half-way."
            )

        with maintenance_lock():
            self.import_documents(folder, lines, options["dry_run"])

    def import_documents(self, folder, lines, dry_run):
        """Every document of the manifest, after what a killed run left is cleaned."""
        self.clean_leftovers(dry_run)
        children = defaultdict(list)

        for line in lines:
            if line.get("parent") is not None:
                children[str(line["parent"])].append(line)

        switched = []
        skipped = []
        warnings = []

        for line in lines:
            if line.get("type") != "document":
                continue

            try:
                problems = self.import_document(
                    folder, line, children[str(line["id"])], dry_run
                )
            except Skipped as reason:
                skipped.append((line["id"], str(reason)))
            # A failure costs its document, rolled back, never the rest of the batch.
            except Exception as error:  # noqa: BLE001  # pylint: disable=broad-exception-caught
                skipped.append((line["id"], f"failed, rolled back: {error}"))
            else:
                switched.append(line["id"])
                warnings.extend((line["id"], problem) for problem in problems)

        verb = "Would switch" if dry_run else "Switched"
        self.stdout.write(f"{verb} {len(switched)} documents to plaintext.")

        for document_id, reason in skipped:
            self.stdout.write(self.style.WARNING(f"Skipped {document_id}: {reason}"))

        for document_id, problem in warnings:
            self.stdout.write(
                self.style.WARNING(f"Switched {document_id}, but {problem}")
            )

    def clean_leftovers(self, dry_run):
        """The objects the upload journal names that a killed run left behind."""
        if dry_run:
            pending = MaintenanceImportUpload.objects.count()

            if pending:
                self.stdout.write(
                    f"Would first clean {pending} uploads a killed run left behind."
                )

            return

        deleted = clean_pending_uploads()

        if deleted:
            self.stdout.write(
                f"Deleted {deleted} plaintext objects a killed run left behind."
            )

    def import_document(self, folder, line, items, dry_run):  # pylint: disable=too-many-locals
        """
        One document: its attachments uploaded under new keys, then its row and
        content switched in one transaction. Returns what went wrong after the
        commit, which never undoes it.
        """
        failed = [item for item in [line, *items] if "error" in item]

        # Its key is about to be dropped: a document is switched only whole, or the
        # items left encrypted could never be opened again.
        if failed:
            raise Skipped(
                f"{len(failed)} of its items were not decrypted ({failed[0]['error']})"
            )

        # A first look, without a lock: everything below until the transaction is
        # uploads, which the row does not wait for.
        document = Document.objects.filter(pk=line["id"]).first()

        if document is None:
            raise Skipped("no longer exists")

        if not document.is_encrypted:
            raise Skipped(
                "already in plaintext" + ("" if dry_run else self.finish(document))
            )

        self.check_unchanged(document, line)
        content = self.read_content(folder, line, document)
        uploads = [
            self.prepare_attachment(document, key, path)
            for key, path in self.check_attachments(
                folder,
                document,
                [item for item in items if item.get("type") == "attachment"],
            )
        ]

        if dry_run:
            return []

        client, bucket = s3()
        targets = [
            (old_key, path, *attachment_upload_target(document, validated, owner))
            for old_key, path, validated, owner in uploads
        ]
        planned = [key for _, _, key, _ in targets]
        # (key, version id) of every object written, deleted unless committed.
        written = []
        mapping = {}
        committed = False

        try:
            # Committed before any upload: a run killed from here on leaves rows
            # naming exactly the objects to delete.
            with transaction.atomic():
                MaintenanceImportUpload.objects.bulk_create(
                    MaintenanceImportUpload(key=key, document_id=document.pk)
                    for key in planned
                )

            for old_key, path, key, extra_args in targets:
                with path.open("rb") as file:
                    response = client.put_object(
                        Bucket=bucket, Key=key, Body=file, **extra_args
                    )

                written.append((key, response.get("VersionId")))
                mapping[old_key] = key

            if content is not None and mapping:
                content = replace_attachment_keys(content, mapping)

            with transaction.atomic():
                document = (
                    Document.objects.select_for_update().filter(pk=line["id"]).first()
                )

                if document is None:
                    raise Skipped("no longer exists")

                # Decrypted from the interface since the first look.
                if not document.is_encrypted:
                    raise Skipped("already in plaintext")

                self.check_unchanged(document, line)

                # media-auth serves a key only to readers of a document listing it.
                document.attachments = [
                    mapping.get(key, key) for key in document.attachments or []
                ]
                document.is_encrypted = False
                document.maintenance_wrapped_document_key = None
                document.save()
                DocumentAccess.objects.filter(document=document).update(
                    encrypted_document_symmetric_key_for_user=None
                )
                # Gone only with the commit: the objects are the document's now.
                MaintenanceImportUpload.objects.filter(key__in=planned).delete()

                if content is not None:
                    # The one write over the ciphertext, its key being fixed: last,
                    # so that only a crash between it and the commit leaves plaintext
                    # content under a row still encrypted (the next run repairs it,
                    # and the purge keeps that version as the plaintext it is).
                    # The tool wrote the raw Yjs update; Docs stores it in base64.
                    response = client.put_object(
                        Bucket=bucket,
                        Key=document.file_key,
                        Body=base64.b64encode(content),
                    )
                    written.append((document.file_key, response.get("VersionId")))

            # Past the block only once the commit went through: a failed commit
            # still counts as not committed.
            committed = True
        except BaseException:
            if not committed:
                # The database rolled back: drop what was written, so the ciphertext
                # is the content again and no plaintext copy is left behind.
                self.undo(written, planned)
            raise

        return self.after_commit(document.pk, list(mapping.values()))

    def check_unchanged(self, document, line):
        """The `updatedAt` compare-and-swap: an edited document waits for a next batch."""
        if document.updated_at != datetime.fromisoformat(line["updatedAt"]):
            raise Skipped("edited since the export: export it again")

    def path_in(self, folder, relative):
        """A file of the decrypted copy, never anything outside its folder."""
        if not isinstance(relative, str) or ".." in PurePosixPath(relative).parts:
            raise Skipped(f"{relative} is not a path inside the folder")

        path = folder / relative

        if not path.resolve().is_relative_to(folder.resolve()) or not path.is_file():
            raise Skipped(f"{relative} is not in the folder")

        return path

    def read_content(self, folder, line, document):
        """The decrypted content, a raw Yjs update, or None when it had none."""
        if "file" not in line:
            return None

        if line["file"] != document.file_key:
            raise Skipped(f"its content is at {line['file']}, not {document.file_key}")

        content = self.path_in(folder, line["file"]).read_bytes()

        # What the frontend could not open would replace a content it can.
        if not is_plain_yjs(base64.b64encode(content)):
            raise Skipped("its decrypted content is not a Yjs document")

        return content

    def check_attachments(self, folder, document, attachments):
        """
        The (key, decrypted file) of each attachment, which must be exactly the
        document's own encrypted attachments: the manifest names a key the import
        reads and replaces, so it never reaches another object, and a document is
        never switched with an attachment left encrypted under a dropped key.
        """
        try:
            expected = encrypted_attachment_keys(document)
        except MissingAttachment as error:
            raise Skipped(str(error)) from error

        given = list(dict.fromkeys(item.get("file") for item in attachments))

        for key in given:
            if key not in expected:
                raise Skipped(
                    f"{key} is not one of its encrypted attachments "
                    f"(listed on it, under {attachment_prefix(document)})"
                )

        missing = [key for key in expected if key not in given]

        if missing:
            raise Skipped(
                f"{len(missing)} of its encrypted attachments are not in the export "
                f"({missing[0]}): export it again"
            )

        return [(key, self.path_in(folder, key)) for key in given]

    def prepare_attachment(self, document, key, path):
        """
        An attachment validated as the upload endpoint validates a file: its type
        detected from its bytes, an unsafe one flagged, under its original name and
        owner. Returns (old key, file, validated data, owner).
        """
        client, bucket = s3()
        head = client.head_object(Bucket=bucket, Key=key)
        disposition = Message()
        disposition["Content-Disposition"] = head.get("ContentDisposition", "")
        name = disposition.get_filename() or PurePosixPath(key).name
        owner = lowercase_keys(head.get("Metadata", {})).get("owner") or (
            document.creator_id or ""
        )

        with path.open("rb") as file:
            serializer = FileUploadSerializer(data={"file": File(file, name=name)})

            try:
                serializer.is_valid(raise_exception=True)
            except ValidationError as error:
                raise Skipped(f"{key} refused as an upload: {error.detail}") from error

            validated = {
                field: value
                for field, value in serializer.validated_data.items()
                if field != "file"
            }

        return key, path, validated, owner

    def undo(self, written, planned):
        """
        Delete the versions written for a document that did not commit, then the
        journal rows of its planned keys; a row whose object could not be deleted
        stays, for the next run to delete it.
        """
        client, bucket = s3()
        kept = set()

        for key, version_id in written:
            try:
                client.delete_object(Bucket=bucket, Key=key, VersionId=version_id)
            except ClientError:
                logger.exception("Could not delete %s version %s", key, version_id)
                kept.add(key)

        try:
            MaintenanceImportUpload.objects.filter(
                key__in=[key for key in planned if key not in kept]
            ).delete()
        except Exception:  # pylint: disable=broad-exception-caught
            # The next run cleans them, finding their objects already gone.
            logger.exception("Could not drop the journal rows of %s", planned)

    def after_commit(self, document_id, keys):
        """
        Send the plaintext attachments to the malware scan, as any upload, and drop
        the cached content metadata. Returns what failed: the document is switched
        either way, and running the import again sends what is still unscanned.
        """
        problems = []

        for key in keys:
            try:
                malware_detection.analyse_file(key, document_id=document_id)
            except Exception as error:  # noqa: BLE001  # pylint: disable=broad-exception-caught
                problems.append(
                    f"{key} was not sent to the malware scan ({error}): run the "
                    "import again to send it"
                )

        try:
            cache.delete(get_content_metadata_cache_key(document_id))
        except Exception as error:  # noqa: BLE001  # pylint: disable=broad-exception-caught
            problems.append(f"its cached content metadata was not dropped ({error})")

        return problems

    def finish(self, document):
        """
        What `after_commit` did not get to do for a document switched by an earlier
        run that stopped after its commit (the process killed, say): its attachments
        never scanned sent to the scan. Returns what the summary says about it.
        """
        client, bucket = s3()
        prefix = attachment_prefix(document)
        unscanned = []

        for key in dict.fromkeys(document.attachments or []):
            if not key.startswith(prefix):
                continue

            try:
                head = client.head_object(Bucket=bucket, Key=key)
            except ClientError:
                continue

            if (
                lowercase_keys(head.get("Metadata", {})).get("status")
                == enums.DocumentAttachmentStatus.PROCESSING.value
            ):
                unscanned.append(key)

        for key in unscanned:
            malware_detection.analyse_file(key, document_id=document.pk)

        return f" ({len(unscanned)} attachments sent to the scan)" if unscanned else ""
