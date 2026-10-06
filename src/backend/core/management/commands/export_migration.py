"""export_migration — export data as JSONL for migration between instances.

Each output line is a self-contained JSON object:

    {"model": "<app_label>.<model>", "pk": "<uuid>", "fields": { ... }}

Models are written in dependency order. Fields and models that do not exist
in the running version are skipped automatically, so the same script runs
across multiple Docs versions.

JSONL goes to stdout; progress and diagnostics go to stderr.

Note: this script was written to be run from a version 3.4.2 or above. All
models that are exported unconditionally are present in v3.4.2. Any model above
v3.4.2 is exported conditionally (only if they exist).

Usage:
    python manage.py export_migration > migration.jsonl
"""

import json
import sys
import uuid
from datetime import datetime

from django.core.management.base import BaseCommand

from core.models import Document, User

try:
    from zoneinfo import ZoneInfo as _ZoneInfo
except ImportError:
    _ZoneInfo = None


class _Encoder(json.JSONEncoder):
    """Serialize types that the standard encoder cannot handle."""

    def default(self, o):
        if isinstance(o, uuid.UUID):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        # timezone_field with use_pytz=False returns ZoneInfo objects;
        # str() gives the IANA name (e.g. "Europe/Paris")
        if _ZoneInfo and isinstance(o, _ZoneInfo):
            return str(o)
        return super().default(o)  # raises TypeError for anything unexpected


def _write(stream, model_label, pk, fields):
    """Emit one JSONL record."""
    stream.write(
        json.dumps(
            {"model": model_label, "pk": str(pk), "fields": fields},
            cls=_Encoder,
        )
    )
    stream.write("\n")


class Command(BaseCommand):
    """Export data as JSONL for migration between instances."""

    help = __doc__

    def handle(self, *args, **options):
        """Run the export, writing JSONL to stdout."""
        self._export(sys.stdout)

    def _export(self, stream):
        self._export_users(stream)
        self._export_documents(stream)

    def _progress(self, label, count, done=False):
        """Overwrite the current stderr line with an incrementing count."""
        ending = "\n" if done else ""
        self.stderr.write(f"\r  {label}: {count}", ending=ending)
        self.stderr.flush()

    def _export_users(self, stream):
        """
        Export all concrete User fields.

        values() returns exactly the fields that exist in the running schema,
        so version-specific fields (e.g. is_first_connection, added in
        migration 0030) are included or omitted automatically.
        M2M fields (groups, user_permissions) are not returned by values().
        """
        self.stderr.write("Exporting users...")
        count = 0
        for user in User.objects.order_by("created_at").values().iterator():
            pk = user.pop("id")
            _write(stream, "core.user", pk, user)
            count += 1
            self._progress("users", count)
        self._progress("users", count, done=True)

    def _export_documents(self, stream):
        """
        Export all concrete Document fields, ordered by path.

        Ordering by path guarantees parents appear before their children,
        which the import script relies on to reconstruct the tree.
        """
        self.stderr.write("Exporting documents...")
        count = 0
        for document in Document.objects.order_by("path").values().iterator():
            pk = document.pop("id")
            _write(stream, "core.document", pk, document)
            count += 1
            self._progress("documents", count)
        self._progress("documents", count, done=True)
