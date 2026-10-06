"""import_migration — import data from a JSONL migration export.

Each input line must be a self-contained JSON object of the following pattern,
and be in dependency order:

    {"model": "<app_label>.<model>", "pk": "<uuid>", "fields": { ... }}

Such a file can be produced by the export_migration management command.

Unknown model labels are skipped with a one-time warning.

Usage:
    python manage.py import_migration migration.jsonl

Or, to pipe from stdin, for example if running the command through docker:
    docker compose exec -T app-dev python manage.py import_migration < data_export.jsonl
"""

import json
import sys

from django.core.management.base import BaseCommand

from core.models import User


class Command(BaseCommand):
    """Import data from a JSONL migration export."""

    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument(
            "input",
            nargs="?",
            default="-",
            help="Path to the JSONL migration file, or - to read from stdin (default).",
        )

    def handle(self, *args, **options):
        """Run the import, reading JSONL from the given file or stdin."""
        if options["input"] == "-":
            self._import(sys.stdin)
        else:
            with open(options["input"], encoding="utf-8") as input_stream:
                self._import(input_stream)

    def _import(self, stream):
        user_uuid_remap = {}
        skipped_models = set()

        # Track the current model section to finalize progress lines cleanly
        # when the model label changes mid-stream.
        current_model = None

        total_entries = 0
        created_entries = 0
        created = False

        for line in stream:
            line = line.strip()
            if not line:
                continue

            record = json.loads(line)
            model_label = record["model"]
            pk = record["pk"]
            fields = record["fields"]

            if model_label != current_model:  # Starting a new model
                if current_model is not None:
                    self._progress(current_model, total_entries, done=True)
                if current_model == "core.user":
                    # Special case the user import, as some may be remapped to existing.
                    self.stderr.write(
                        f"  {created_entries} created, "
                        f"{total_entries - created_entries} remapped to existing"
                    )

                total_entries = 0
                created_entries = 0
                created = False
                current_model = model_label
                self.stderr.write(f"Importing {current_model}...")

            if model_label == "core.user":
                created = self._import_user(pk, fields, user_uuid_remap)
                total_entries += 1
                if created:
                    created_entries += 1
                self._progress(model_label, total_entries)
            elif model_label not in skipped_models:
                self.stderr.write(f"  skipping {model_label} (not yet implemented)")
                skipped_models.add(model_label)

        # Finalize the last section if the stream ended mid-section.
        self._progress(current_model, total_entries, done=True)

    def _progress(self, label, count, done=False):
        """Overwrite the current stderr line with an incrementing count."""
        ending = "\n" if done else ""
        self.stderr.write(f"\r  {label}: {count}", ending=ending)
        self.stderr.flush()

    def _import_user(self, pk, fields, user_uuid_remap):
        """
        Import one user record.

        Returns True if a new row was created, False if the user already existed.

        When a user with the same OIDC sub already exists on this instance, no new
        row is created. Instead, the imported UUID is recorded in user_uuid_remap
        so that all FK references in subsequent records are rewritten to the
        correct local UUID.

        Users with no sub (device accounts, admin-only accounts) are matched by
        their imported UUID instead.
        """
        sub = fields.get("sub")
        if sub:
            existing = User.objects.filter(sub=sub).values("id").first()
            if existing:
                user_uuid_remap[pk] = str(existing["id"])
                return False

        if User.objects.filter(id=pk).exists():
            return False

        # Users exported from a version that predates is_first_connection (added
        # after v3.4.2) won't have the field in their record. Default to False:
        # these users already connected on the source instance, so there is no
        # reason to put them through the onboarding flow again.
        if "is_first_connection" not in fields:
            fields = {**fields, "is_first_connection": False}

        # bulk_create bypasses User.save(), which avoids triggering onboarding
        # side-effects (document access grants, sandbox duplication, invitation
        # conversion) for imported users.
        User.objects.bulk_create([User(**fields, id=pk)])
        return True
