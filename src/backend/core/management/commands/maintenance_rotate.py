"""
Write back the maintenance copies the encryption service's maintenance tool re-wrapped
for a new maintenance key, from the export of `maintenance_export --keys-only`: a
folder with `manifest.ndjson`, whose lines carry the new copy (`maintenanceKey`) and
the one it replaces (`previousMaintenanceKey`). It holds wrapped keys only, no secret.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from rest_framework.exceptions import ValidationError

from core.api.serializers import validate_maintenance_key
from core.models import Document
from core.utils.maintenance_escrow import MANIFEST_FILE, read_manifest


class Command(BaseCommand):
    """Replace each document's maintenance copy with the one re-wrapped for the new key."""

    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument(
            "folder",
            help="The maintenance tool's rotation output, with manifest.ndjson at its root.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Check every document and say what would happen, changing nothing.",
        )

    def handle(self, *args, **options):
        lines = read_manifest(options["folder"])
        not_rotated = [
            line.get("id") for line in lines if "previousMaintenanceKey" not in line
        ]

        # The tool adds it to every line it hands back: a line without it is the
        # export itself, or another command's folder.
        if not_rotated:
            raise CommandError(
                f"{len(not_rotated)} lines of {MANIFEST_FILE} carry no "
                f"previousMaintenanceKey, the first for {not_rotated[0]}: this is not "
                "the output of the maintenance tool's rotation. Nothing was rotated."
            )

        rotated = 0
        skipped = []

        # One transaction for the whole file, unlike the import's one per document:
        # the run only writes one small column, never the object storage, so a
        # failure leaves nothing outside the database to undo, and all or nothing
        # leaves no half-rotated batch to reason about (run it again, whole).
        with transaction.atomic():
            for line in lines:
                reason = self.rotate(line, options["dry_run"])

                if reason is None:
                    rotated += 1
                else:
                    skipped.append((line.get("id"), reason))

        verb = "Would rotate" if options["dry_run"] else "Rotated"
        self.stdout.write(f"{verb} the maintenance copies of {rotated} documents.")

        for document_id, reason in skipped:
            self.stdout.write(self.style.WARNING(f"Skipped {document_id}: {reason}"))

    @staticmethod
    def rotate(line, dry_run):
        """Rotate one document's copy. Returns why it was skipped, or None."""
        if "error" in line:
            return f"the maintenance tool could not re-wrap its copy ({line['error']})"

        copy = line.get("maintenanceKey")

        if not isinstance(copy, str):
            return "the maintenance tool gave no new copy"

        try:
            # The same check as the endpoint storing a copy from a browser.
            validate_maintenance_key(copy)
        except ValidationError:
            return "the new copy is not a maintenance copy"

        documents = Document.objects.filter(pk=line["id"])
        # Only over the exact copy exported: a document whose copy changed since
        # (its encryption removed, then encrypted again under a new document key)
        # keeps the one it has now. A queryset update leaves updated_at alone:
        # rotating a copy is not an edit of the document.
        unchanged = documents.filter(
            maintenance_wrapped_document_key=line["previousMaintenanceKey"]
        )

        if (
            unchanged.exists()
            if dry_run
            else unchanged.update(maintenance_wrapped_document_key=copy)
        ):
            return None

        if documents.exists():
            return "its copy changed since the export"

        return "no longer exists"
