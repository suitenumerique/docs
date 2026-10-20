"""
After a batch recovery: delete the ciphertext the import left in the bucket for the
documents it switched back to plaintext, the encrypted versions of their content and
their old encrypted attachments (the import uploaded the plaintext under new keys).
The import keeps them so that a problem found afterwards can still be investigated;
once the batch is checked, they serve nothing, since the keys that opened them are
gone, and restoring a content version would put ciphertext back as the content.

It also deletes what a killed import left behind, the plaintext objects its upload
journal names that no document lists, as the next import would.
"""

from collections import defaultdict

from django.core.cache import cache
from django.core.management.base import BaseCommand

from core.api.utils import get_content_metadata_cache_key
from core.models import Document, MaintenanceImportUpload
from core.utils.maintenance_escrow import (
    clean_pending_uploads,
    encrypted_versions,
    maintenance_lock,
    read_manifest,
    s3,
)


class Command(BaseCommand):
    """List, then delete, the encrypted versions of the documents a batch switched."""

    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument(
            "folder",
            help="The decrypted copy given to maintenance_import, for its manifest.",
        )
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Delete them, for good; without it, only list them.",
        )

    def handle(self, *args, **options):
        lines = read_manifest(options["folder"])

        with maintenance_lock():
            self.purge(lines, options["delete"])

    def purge(self, lines, delete):
        """The leftover uploads, then the ciphertext of every switched document."""
        if delete:
            deleted = clean_pending_uploads()
            self.stdout.write(
                f"Deleted {deleted} plaintext objects a killed import left behind."
            )
        else:
            self.stdout.write(
                f"Found {MaintenanceImportUpload.objects.count()} uploads a killed "
                "import left behind."
            )

        attachments = defaultdict(list)

        for line in lines:
            if line.get("parent") is not None and "file" in line:
                attachments[str(line["parent"])].append(line["file"])

        client, bucket = s3()
        count = size = documents = 0

        for line in lines:
            if line.get("type") != "document":
                continue

            document = Document.objects.filter(pk=line["id"]).first()

            # Still encrypted (skipped by the import): its versions are its content.
            if document is None or document.is_encrypted:
                continue

            found = list(encrypted_versions(document, attachments[str(document.pk)]))

            if not found:
                continue

            documents += 1

            for key, version_id, version_size in found:
                count += 1
                size += version_size
                self.stdout.write(f"{key} {version_id}")

                if delete:
                    client.delete_object(Bucket=bucket, Key=key, VersionId=version_id)

            if delete:
                cache.delete(get_content_metadata_cache_key(document.pk))

        verb = "Deleted" if delete else "Found"
        self.stdout.write(
            f"{verb} {count} encrypted versions ({size} bytes) in {documents} documents."
        )
