"""
Export the encrypted documents for a batch recovery by the encryption service's
maintenance tool: a folder holding `manifest.ndjson` and the encrypted attachments,
copied from the object storage under their own keys. With `--keys-only`, only the
maintenance copies, for the tool to rotate them to a new maintenance key.
"""

import base64
import json
import shutil
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db.models import BinaryField, Q
from django.db.models.expressions import RawSQL

from botocore.exceptions import ClientError

from core.models import Document
from core.utils.maintenance_escrow import (
    MANIFEST_FILE,
    MissingAttachment,
    encrypted_attachment_keys,
    key_id_from_fingerprint,
    read_stored_content,
    s3,
)

# How many ids a summary line names before it only counts.
LISTED_IDS = 5


def summarize(ids):
    """A few ids, then how many more."""
    listed = ", ".join(str(pk) for pk in ids[:LISTED_IDS])

    return listed + (
        f" and {len(ids) - LISTED_IDS} more" if len(ids) > LISTED_IDS else ""
    )


class Command(BaseCommand):
    """Export the encrypted documents for the maintenance tool."""

    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            required=True,
            help="Folder to write the export into; created, and refused if not empty.",
        )
        parser.add_argument(
            "--fingerprint",
            help=(
                "Only the documents escrowed for this maintenance key: its fingerprint, "
                "the 40 digits the maintenance tool and the encryption server's startup "
                "log show (spaces allowed). Without it, every escrowed document."
            ),
        )
        parser.add_argument(
            "--keys-only",
            action="store_true",
            help=(
                "Only one line per document with its maintenance copy, no content and "
                "no attachment: what the maintenance tool re-wraps for a new maintenance "
                "key, before maintenance_rotate writes the new copies back. Usually "
                "with the --fingerprint of the key being replaced."
            ),
        )

    def handle(self, *args, **options):
        output = Path(options["output"])
        key_id = None

        if options.get("fingerprint"):
            try:
                key_id = key_id_from_fingerprint(options["fingerprint"])
            except ValueError as error:
                raise CommandError(str(error)) from error

        if output.exists() and not output.is_dir():
            raise CommandError(f"{output} is not a folder.")

        if output.exists() and any(output.iterdir()):
            raise CommandError(f"{output} is not empty.")

        output.mkdir(parents=True, exist_ok=True)

        # Trashed documents included: they can still be restored, encrypted.
        encrypted = Document.objects.filter(is_encrypted=True)
        no_copy = encrypted.filter(
            Q(maintenance_wrapped_document_key__isnull=True)
            | Q(maintenance_wrapped_document_key="")
        )
        escrowed = encrypted.exclude(pk__in=no_copy.values("pk"))

        if key_id is not None:
            # Bytes 2 to 17 of a maintenance copy are the id of the key it was made
            # for: one organization's documents, without knowing their owners.
            escrowed = escrowed.alias(
                maintenance_key_id=RawSQL(
                    "substring(decode(maintenance_wrapped_document_key, 'base64') "
                    "from 2 for 16)",
                    (),
                    output_field=BinaryField(),
                )
            ).filter(maintenance_key_id=bytes.fromhex(key_id))

        if options["keys_only"]:
            self.export_keys(escrowed, output)
            return

        documents = attachments = 0
        missing_objects = []

        with (output / MANIFEST_FILE).open("w", encoding="utf-8") as manifest:
            for document in escrowed.order_by("path").iterator():
                try:
                    lines = self.export_document(document, output)
                except MissingAttachment as error:
                    missing_objects.append((document.pk, str(error)))
                    continue

                for line in lines:
                    manifest.write(json.dumps(line) + "\n")
                    attachments += line["type"] == "attachment"

                documents += 1

        self.stdout.write(
            f"Exported {documents} documents and {attachments} attachments to {output}."
        )

        for document_id, reason in missing_objects:
            self.stdout.write(
                self.style.WARNING(
                    f"Left out {document_id}: {reason}, so it could never be "
                    "switched whole."
                )
            )

        without = list(no_copy.order_by("path").values_list("pk", flat=True))

        if without:
            self.stdout.write(
                self.style.WARNING(
                    f"{len(without)} encrypted documents have no maintenance copy and "
                    "cannot be recovered this way"
                    # Without a copy, a document names no key: it cannot be told
                    # which organization it belongs to.
                    + (", whatever their organization" if key_id else "")
                    + f": {summarize(without)}."
                )
            )

    def export_keys(self, escrowed, output):
        """
        One line per document, its maintenance copy alone. A document without a
        copy has nothing to rotate: the backfill gives it one for the new key.
        """
        documents = 0

        with (output / MANIFEST_FILE).open("w", encoding="utf-8") as manifest:
            for document in (
                escrowed.order_by("path")
                .only("id", "maintenance_wrapped_document_key")
                .iterator()
            ):
                manifest.write(json.dumps(self.key_line(document)) + "\n")
                documents += 1

        self.stdout.write(
            f"Exported the maintenance copies of {documents} documents to {output}."
        )

    @staticmethod
    def key_line(document):
        """The manifest line of a document, as far as its maintenance copy goes."""
        return {
            "id": str(document.pk),
            "type": "document",
            "maintenanceKey": document.maintenance_wrapped_document_key,
        }

    def export_document(self, document, output):
        """
        The manifest lines of one document, its content and attachments copied into
        the folder. Raises MissingAttachment, its files removed, when an attachment
        is gone from the bucket.
        """
        client, bucket = s3()
        line = {
            **self.key_line(document),
            "title": document.title,
            # The exact stored value: the import writes back only if it is unchanged.
            "updatedAt": document.updated_at.isoformat(),
        }

        stored = read_stored_content(document)

        if stored is not None:
            # Stored as the base64 of the ciphertext; the tool reads the raw ciphertext.
            # In a file of its own, not inline: a manifest of a hundred thousand
            # documents stays a few megabytes a browser parses at once.
            destination = output / document.file_key
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(base64.b64decode(b"".join(stored.split())))
            line["file"] = document.file_key

        lines = [line]

        try:
            keys = encrypted_attachment_keys(document)

            for key in keys:
                destination = output / key
                destination.parent.mkdir(parents=True, exist_ok=True)

                try:
                    # Streamed to the file in chunks: never whole in memory.
                    client.download_file(bucket, key, str(destination))
                except ClientError as error:
                    if error.response["Error"]["Code"] not in ("NoSuchKey", "404"):
                        raise

                    raise MissingAttachment(f"{key} is not in the bucket") from error
        except MissingAttachment:
            shutil.rmtree(output / document.key_base, ignore_errors=True)
            raise

        for key in keys:
            lines.append(
                {
                    "id": key,
                    "type": "attachment",
                    # Encrypted with the document's own key: no key of its own.
                    "parent": str(document.pk),
                    "file": key,
                }
            )

        return lines
