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

from core.models import (
    Document,
    DocumentAccess,
    DocumentAskForAccess,
    DocumentFavorite,
    Invitation,
    LinkTrace,
    User,
)

try:
    from core.models import Comment, Reaction, Thread

    _HAS_THREADS = True
except ImportError:
    _HAS_THREADS = False

try:
    from core.models import UserReconciliation, UserReconciliationCsvImport

    _HAS_RECONCILIATION = True
except ImportError:
    _HAS_RECONCILIATION = False

try:
    from core.models import Mention

    _HAS_MENTION = True
except ImportError:
    _HAS_MENTION = False

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
        self._export_document_accesses(stream)
        self._export_invitations(stream)
        self._export_link_traces(stream)
        self._export_document_ask_for_accesses(stream)
        self._export_document_favorites(stream)
        if _HAS_RECONCILIATION:
            self._export_user_reconciliations(stream)
            self._export_user_reconciliation_csv_imports(stream)
        if _HAS_THREADS:
            self._export_threads(stream)
            self._export_comments(stream)
            self._export_reactions(stream)
        if _HAS_MENTION:
            self._export_mentions(stream)

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

    def _export_document_accesses(self, stream):
        """Export all concrete DocumentAccess fields."""
        self.stderr.write("Exporting document accesses...")
        count = 0
        for access in DocumentAccess.objects.order_by("created_at").values().iterator():
            pk = access.pop("id")
            _write(stream, "core.documentaccess", pk, access)
            count += 1
            self._progress("document accesses", count)
        self._progress("document accesses", count, done=True)

    def _export_invitations(self, stream):
        """Export all concrete Invitation fields."""
        self.stderr.write("Exporting invitations...")
        count = 0
        for invitation in Invitation.objects.order_by("created_at").values().iterator():
            pk = invitation.pop("id")
            _write(stream, "core.invitation", pk, invitation)
            count += 1
            self._progress("invitations", count)
        self._progress("invitations", count, done=True)

    def _export_link_traces(self, stream):
        """Export all concrete LinkTrace fields."""
        self.stderr.write("Exporting link traces...")
        count = 0
        for trace in LinkTrace.objects.order_by("created_at").values().iterator():
            pk = trace.pop("id")
            _write(stream, "core.linktrace", pk, trace)
            count += 1
            self._progress("link traces", count)
        self._progress("link traces", count, done=True)

    def _export_document_ask_for_accesses(self, stream):
        """Export all concrete DocumentAskForAccess fields."""
        self.stderr.write("Exporting document ask-for-accesses...")
        count = 0
        for ask in (
            DocumentAskForAccess.objects.order_by("created_at").values().iterator()
        ):
            pk = ask.pop("id")
            _write(stream, "core.documentaskforaccess", pk, ask)
            count += 1
            self._progress("document ask-for-accesses", count)
        self._progress("document ask-for-accesses", count, done=True)

    def _export_document_favorites(self, stream):
        """Export all concrete DocumentFavorite fields."""
        self.stderr.write("Exporting document favorites...")
        count = 0
        for favorite in (
            DocumentFavorite.objects.order_by("created_at").values().iterator()
        ):
            pk = favorite.pop("id")
            _write(stream, "core.documentfavorite", pk, favorite)
            count += 1
            self._progress("document favorites", count)
        self._progress("document favorites", count, done=True)

    def _export_user_reconciliations(self, stream):
        """Export all concrete UserReconciliation fields."""
        self.stderr.write("Exporting user reconciliations...")
        count = 0
        for reconciliation in (
            UserReconciliation.objects.order_by("created_at").values().iterator()
        ):
            pk = reconciliation.pop("id")
            _write(stream, "core.userreconciliation", pk, reconciliation)
            count += 1
            self._progress("user reconciliations", count)
        self._progress("user reconciliations", count, done=True)

    def _export_user_reconciliation_csv_imports(self, stream):
        """Export all concrete UserReconciliationCsvImport fields."""
        self.stderr.write("Exporting user reconciliation CSV imports...")
        count = 0
        for csv_import in (
            UserReconciliationCsvImport.objects.order_by("created_at")
            .values()
            .iterator()
        ):
            pk = csv_import.pop("id")
            _write(stream, "core.userreconciliationcsvimport", pk, csv_import)
            count += 1
            self._progress("user reconciliation CSV imports", count)
        self._progress("user reconciliation CSV imports", count, done=True)

    def _export_threads(self, stream):
        """Export all concrete Thread fields."""
        self.stderr.write("Exporting threads...")
        count = 0
        for thread in Thread.objects.order_by("created_at").values().iterator():
            pk = thread.pop("id")
            _write(stream, "core.thread", pk, thread)
            count += 1
            self._progress("threads", count)
        self._progress("threads", count, done=True)

    def _export_comments(self, stream):
        """Export all concrete Comment fields."""
        self.stderr.write("Exporting comments...")
        count = 0
        for comment in Comment.objects.order_by("created_at").values().iterator():
            pk = comment.pop("id")
            _write(stream, "core.comment", pk, comment)
            count += 1
            self._progress("comments", count)
        self._progress("comments", count, done=True)

    def _export_reactions(self, stream):
        """
        Export Reaction rows and their M2M user associations separately.

        values() skips the M2M users field, so the through table is exported
        as a distinct record type (core.reaction_users).
        """
        self.stderr.write("Exporting reactions...")
        count = 0
        for reaction in Reaction.objects.order_by("created_at").values().iterator():
            pk = reaction.pop("id")
            _write(stream, "core.reaction", pk, reaction)
            count += 1
            self._progress("reactions", count)
        self._progress("reactions", count, done=True)

        self.stderr.write("Exporting reaction users...")
        count = 0
        for row in Reaction.users.through.objects.values().iterator():
            pk = row.pop("id")
            _write(stream, "core.reaction_users", pk, row)
            count += 1
            self._progress("reaction users", count)
        self._progress("reaction users", count, done=True)

    def _export_mentions(self, stream):
        """Export all concrete Mention fields."""
        self.stderr.write("Exporting mentions...")
        count = 0
        for mention in Mention.objects.order_by("created_at").values().iterator():
            pk = mention.pop("id")
            _write(stream, "core.mention", pk, mention)
            count += 1
            self._progress("mentions", count)
        self._progress("mentions", count, done=True)
