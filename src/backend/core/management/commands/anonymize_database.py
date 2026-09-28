"""anonymize_database — irreversibly scrub PII from a RESTORED production copy.

Intended workflow for turning a production ``pg_dump`` into a shareable,
same-shaped staging database WITHOUT ever handling production personal data in
staging:

    1. Restore the dump into an ISOLATED throwaway database (separate cluster /
       namespace, no egress, credentials that cannot reach production).
    2. Point this command at that restored database and run it.
    3. Re-dump the now-anonymized database; that dump is safe to load anywhere.

It overwrites — in place, irreversibly — every column that holds personal data
(emails, names, the OIDC ``sub``), user-generated content (document titles and
excerpts, comment bodies, thread/comment metadata) and secrets (password
hashes), and TRUNCATEs the operational tables that embed identity (sessions,
admin log, thumbnail cache). Structural columns that make
the data realistic for load testing — the tree ``path``/``depth``/``numchild``,
``link_reach``, roles, foreign keys, row counts, timestamps — are deliberately
preserved, so the result pairs naturally with ``profile_volumetry`` /
``generate_volumetry``.

Anonymization is length-preserving where it can be (titles/excerpts become runs
of ``x`` of the same length) and keyed on each row's primary key where a value
must stay unique (emails, ``sub``), so unique constraints keep holding and the
scrub is deterministic and idempotent.

SAFETY. Because it destroys data, it refuses to run unless BOTH of these hold:
  * the environment variable ``DOCS_ALLOW_ANONYMIZATION=1`` is set (production
    must never set it), and
  * ``--yes`` is passed on the command line.
Use ``--expect-db NAME`` to assert the connected database's name before writing,
and ``--dry-run`` to print exactly what would run and touch nothing. It never
targets object storage — the S3 documents/attachments the dump references are
not in the dump and are handled separately.
"""

import os

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

ALLOW_ENV = "DOCS_ALLOW_ANONYMIZATION"

# Field-level scrubs: (table, {column: sql_expression}). Each expression is
# evaluated per row and may reference that row's own columns (notably `id`, a
# UUID, used to keep anonymized unique values unique). Identifiers here are
# trusted constants from this file, never user input.
SCRUBS = [
    (
        "impress_user",
        {
            # Nullable identity columns: preserve NULLs (they matter to the
            # profile's shape); otherwise replace with a per-row value that stays
            # unique against sub / admin_email unique constraints.
            "sub": "CASE WHEN sub IS NULL THEN NULL ELSE 'anon-' || id END",
            "email": (
                "CASE WHEN email IS NULL THEN NULL "
                "ELSE 'user-' || id || '@anon.invalid' END"
            ),
            "admin_email": (
                "CASE WHEN admin_email IS NULL THEN NULL "
                "ELSE 'admin-' || id || '@anon.invalid' END"
            ),
            "full_name": (
                "CASE WHEN full_name IS NULL THEN NULL "
                "ELSE 'User ' || left(id::text, 8) END"
            ),
            "short_name": "CASE WHEN short_name IS NULL THEN NULL ELSE 'User' END",
            # Reset every password hash to an unusable placeholder.
            "password": "'!'",
        },
    ),
    (
        "impress_user_reconciliation",
        {
            "active_email": "'active-' || id || '@anon.invalid'",
            "inactive_email": "'inactive-' || id || '@anon.invalid'",
            "source_unique_id": (
                "CASE WHEN source_unique_id IS NULL THEN NULL ELSE 'src-' || id END"
            ),
            "logs": "''",
            # Invalidate any email-confirmation token that leaked via the dump.
            "active_email_confirmation_id": "gen_random_uuid()",
            "inactive_email_confirmation_id": "gen_random_uuid()",
        },
    ),
    (
        "impress_user_reconciliation_csv_import",
        # `file` is the storage path of an uploaded CSV of real users; `logs` may
        # quote their emails. The CSV object itself lives in storage, not the dump.
        {"file": "''", "logs": "''"},
    ),
    (
        "impress_document",
        {
            # Length-preserving: strip content, keep the size so search/list and
            # index volumetry stay representative. attachments (UUID-based S3
            # keys) carry no PII and are kept for media-auth volumetry.
            "title": "CASE WHEN title IS NULL THEN NULL "
            "ELSE left(repeat('x', length(title)), 255) END",
            "excerpt": "CASE WHEN excerpt IS NULL THEN NULL "
            "ELSE left(repeat('x', length(excerpt)), 300) END",
        },
    ),
    (
        "impress_document_access",
        # Team identifiers may name a real org/team. Pseudonymize deterministically
        # so equal teams stay equal (preserving the unique(team, document) shape).
        {"team": "CASE WHEN team = '' THEN '' ELSE 'team-' || left(md5(team), 10) END"},
    ),
    (
        "impress_invitation",
        # email is NOT NULL and unique per document; key on id to keep it unique.
        {"email": "'invitee-' || id || '@anon.invalid'"},
    ),
    (
        "impress_thread",
        {"metadata": "'{}'::jsonb"},
    ),
    (
        "impress_comment",
        # body/metadata are free-form user content.
        {"body": "'{}'::jsonb", "metadata": "'{}'::jsonb"},
    ),
]

# Whole tables wiped: operational/transient data that embeds identity and is not
# needed for a staging clone. TRUNCATE ... CASCADE so FK-dependent rows go too.
TRUNCATES = [
    "django_session",  # session_data can carry the authenticated identity
    "django_admin_log",  # object_repr / change_message leak titles and emails
    "easy_thumbnails_source",  # thumbnail cache: media file paths
    "easy_thumbnails_thumbnail",
]


class Command(BaseCommand):
    """Irreversibly anonymize the connected (restored) database in place."""

    help = __doc__

    def add_arguments(self, parser):
        """Define command arguments."""
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Confirm the irreversible in-place scrub (required to write).",
        )
        parser.add_argument(
            "--expect-db",
            default=None,
            help="Abort unless the connected database has this exact NAME.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print every statement and table check; change nothing.",
        )
        parser.add_argument(
            "--report-unhandled",
            action="store_true",
            help="Also list text/json columns not covered here, for human review.",
        )

    def handle(self, *args, **options):
        """Run the guarded anonymization pass."""
        db = connection.settings_dict
        target = (
            f"{db.get('NAME')} on {db.get('HOST')}:{db.get('PORT')} as {db.get('USER')}"
        )

        if os.environ.get(ALLOW_ENV) != "1":
            raise CommandError(
                f"Refusing to run: {ALLOW_ENV} is not set to '1'. This command "
                "destroys data and must only run against an ISOLATED restored copy. "
                f"Set {ALLOW_ENV}=1 in that environment (production never should) "
                "and retry."
            )
        if options["expect_db"] and db.get("NAME") != options["expect_db"]:
            raise CommandError(
                f"Connected database is '{db.get('NAME')}', not "
                f"'{options['expect_db']}' as asserted by --expect-db. Aborting."
            )
        if not options["yes"] and not options["dry_run"]:
            raise CommandError(
                "Refusing to write without --yes. Re-run with --dry-run to preview, "
                "or --yes to perform the irreversible scrub."
            )

        self.stdout.write(self.style.WARNING(f"Target database: {target}"))
        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be written."))

        with connection.cursor() as cursor:
            if options["dry_run"]:
                self._run(cursor, dry_run=True)
            else:
                # All-or-nothing: a failure rolls the whole scrub back.
                with transaction.atomic():
                    self._run(cursor, dry_run=False)
            if options["report_unhandled"]:
                self._report_unhandled(cursor)

        if not options["dry_run"]:
            self.stdout.write(
                self.style.SUCCESS(
                    "\nAnonymization complete. Run VACUUM ANALYZE, then re-dump; "
                    "the new dump is safe to load into staging."
                )
            )

    def _run(self, cursor, dry_run):
        """Execute (or print) every scrub and truncate against existing tables."""
        for table, columns in SCRUBS:
            present = self._existing_columns(cursor, table)
            if present is None:
                self.stdout.write(f"  skip {table}: table absent")
                continue
            assignments = {c: e for c, e in columns.items() if c in present}
            missing = set(columns) - set(assignments)
            if missing:
                self.stdout.write(
                    self.style.WARNING(
                        f"  {table}: columns absent, not scrubbed: {sorted(missing)}"
                    )
                )
            if not assignments:
                continue
            set_clause = ", ".join(
                f"{col} = {expr}" for col, expr in assignments.items()
            )
            sql = f"UPDATE {table} SET {set_clause}"  # noqa: S608 (trusted constants)
            if dry_run:
                self.stdout.write(f"  would scrub {table}: {sorted(assignments)}")
                continue
            cursor.execute(sql)
            self.stdout.write(
                f"  scrubbed {table}.{sorted(assignments)} ({cursor.rowcount} rows)"
            )

        for table in TRUNCATES:
            if self._existing_columns(cursor, table) is None:
                self.stdout.write(f"  skip {table}: table absent")
                continue
            if dry_run:
                self.stdout.write(f"  would TRUNCATE {table} CASCADE")
                continue
            cursor.execute(f"TRUNCATE {table} CASCADE")
            self.stdout.write(f"  truncated {table}")

    @staticmethod
    def _existing_columns(cursor, table):
        """Return the set of column names of ``table``, or None if it is absent."""
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s",
            [table],
        )
        rows = cursor.fetchall()
        return {r[0] for r in rows} if rows else None

    def _report_unhandled(self, cursor):
        """List text/json columns in public not covered here, for manual review.

        A coverage aid, not a guarantee: it flags every free-text-ish column that
        is neither scrubbed nor in a wiped table, so an operator can confirm none
        of them can hold personal data before trusting the dump.
        """
        handled = {(t, c) for t, cols in SCRUBS for c in cols}
        wiped = set(TRUNCATES)
        cursor.execute(
            "SELECT table_name, column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = 'public' "
            "AND data_type IN ('character varying', 'text', 'json', 'jsonb', 'citext') "
            "ORDER BY table_name, column_name"
        )
        unhandled = [
            (t, c, d)
            for t, c, d in cursor.fetchall()
            if t not in wiped and (t, c) not in handled
        ]
        self.stdout.write(
            self.style.WARNING(
                f"\nCoverage review: {len(unhandled)} text/json column(s) are NOT "
                "scrubbed or wiped. Confirm none can hold personal data:"
            )
        )
        for table, column, dtype in unhandled:
            self.stdout.write(f"    {table}.{column} ({dtype})")
