"""
Replay the legacy content of the documents into the collaboration server.

The content of a document used to be a file in our object storage, one version
per save; it now lives in the collaboration server, which is able to read those
versions back and rebuild the history from them, document by document. This
command is what hands it the corpus.

It is meant to be run again: every document it finishes is recorded, and the
collaboration server answers "already" for anything it has already migrated, so
a run that is interrupted, rate limited or killed simply picks up where it
stopped. Nothing is destroyed, on either side.

One document can also be handed over on its own with `--document-id`, which is
how a document a run left behind is dealt with once its cause is understood.
"""

import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core import models
from core.services.yhub_services import APIError, YHubError, YHubService

logger = logging.getLogger("impress.commands.migrate_documents")

# Reported often enough to see a run is alive, rarely enough to keep the logs
# of a corpus of hundreds of thousands of documents readable.
PROGRESS_EVERY = 500

# Results are written in batches: a smaller one costs a query per document, a
# larger one loses more work when the command is killed — and losing it only
# means handing those documents over again, which answers "already".
WRITE_BATCH = 200

# The collaboration server says whether it is worth insisting: a 5xx or a 429
# is a server that is unwell or busy, anything else in the 4xx range is about
# this document and will fail the same way forever.
RETRY_STATUSES = frozenset({429})


class Command(BaseCommand):
    """Migrate the legacy content of the documents into the collaboration server."""

    help = __doc__

    def add_arguments(self, parser):
        """Define the arguments of the command."""
        parser.add_argument(
            "--document-id",
            type=uuid.UUID,
            default=None,
            help=(
                "Migrate this document alone, whatever a previous run recorded "
                "for it. The filters selecting a corpus (--created-before, "
                "--limit, --retry-failed) do not apply to it."
            ),
        )
        parser.add_argument(
            "--concurrency",
            type=int,
            default=2,
            help=(
                "Documents migrated at the same time. The replay runs on the "
                "main thread of the collaboration server, so this is bounded "
                "by its cpu: raise it against a pool that serves nothing else."
            ),
        )
        parser.add_argument(
            "--rate",
            type=float,
            default=0,
            help="Documents per second not to exceed (0: as fast as possible)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Stop after this many documents (0: all of them)",
        )
        parser.add_argument(
            "--created-before",
            type=str,
            default=None,
            help=(
                "Only migrate the documents created before this date "
                "(ISO 8601). Documents created after the collaboration server "
                "became the source of truth have no legacy content."
            ),
        )
        parser.add_argument(
            "--retry-failed",
            action="store_true",
            default=False,
            help="Hand over the documents a previous run could not migrate",
        )
        parser.add_argument(
            "--retries",
            type=int,
            default=3,
            help="Attempts per document when the collaboration server is unwell",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Count what would be migrated, call nothing",
        )

    def handle(self, *args, **options):
        """Hand the documents to the collaboration server, and record what it says."""
        queryset = self.get_queryset(options)
        total = queryset.count()

        if options["dry_run"]:
            self.stdout.write(f"{total:d} documents to migrate")
            return

        self.stdout.write(
            f"Migrating {total:d} documents, {options['concurrency']:d} at a time"
        )
        started = time.monotonic()
        counts = self.migrate(queryset, options)
        elapsed = time.monotonic() - started

        done = sum(counts.values())
        rate = done / elapsed if elapsed else 0
        self.stdout.write(
            f"Migrated {done:d} documents in {elapsed:.0f}s ({rate:.1f}/s): "
            + ", ".join(
                f"{status}={count:d}" for status, count in sorted(counts.items())
            )
        )
        if counts.get(models.DocumentMigrationStatus.FAILED):
            self.stdout.write(
                self.style.WARNING(
                    "Some documents could not be migrated, they are recorded as "
                    "failed: run again with --retry-failed once the cause is fixed."
                )
            )

    def get_queryset(self, options):
        """
        Return the documents left to migrate, the ones that matter most first.

        A document is opened before it is missed: the ones edited recently are
        the ones users are about to read, and until a document is migrated the
        collaboration server only seeds its latest state, without its history.

        Naming one document is an instruction rather than a filter: it is handed
        over even when a previous run recorded it as done, which costs a call
        the collaboration server answers with "already". Nothing else would be
        useful — a command asked for one document and reporting that it had
        nothing to do says neither what happened nor why.
        """
        if options["document_id"]:
            queryset = models.Document.objects.filter(pk=options["document_id"])
            if not queryset.exists():
                raise CommandError(f"No document with id {options['document_id']}")

            return queryset

        queryset = models.Document.objects.all()

        if options["created_before"]:
            queryset = queryset.filter(created_at__lt=options["created_before"])

        done = set(models.DocumentMigrationStatus.values)
        if options["retry_failed"]:
            done.discard(models.DocumentMigrationStatus.FAILED)

        queryset = queryset.exclude(migration__status__in=done)

        if options["limit"]:
            queryset = queryset.order_by("-updated_at")[: options["limit"]]
            # a sliced queryset cannot be iterated with a server-side cursor
            return models.Document.objects.filter(
                pk__in=queryset.values("pk")
            ).order_by("-updated_at")

        return queryset.order_by("-updated_at")

    def migrate(self, queryset, options):
        """Run the migration, writing what happened as the answers come in."""
        counts = {}
        results = []
        done = 0
        started = time.monotonic()

        with ThreadPoolExecutor(max_workers=options["concurrency"]) as pool:
            # imap-like: the documents are read from the database as the pool
            # frees up, so a corpus of any size is never held in memory
            documents = queryset.only("pk").iterator(chunk_size=WRITE_BATCH)
            migrations = pool.map(
                lambda document: self.migrate_document(document, options["retries"]),
                self.paced(documents, options["rate"]),
            )

            for migration in migrations:
                results.append(migration)
                counts[migration.status] = counts.get(migration.status, 0) + 1
                done += 1

                if len(results) >= WRITE_BATCH:
                    self.save(results)
                    results = []
                if done % PROGRESS_EVERY == 0:
                    rate = done / (time.monotonic() - started)
                    self.stdout.write(f"  {done:d} documents ({rate:.1f}/s)")

        self.save(results)

        return counts

    @staticmethod
    def paced(documents, rate):
        """Yield the documents no faster than `rate` per second."""
        if not rate:
            yield from documents
            return

        interval = 1 / rate
        next_at = time.monotonic()
        for document in documents:
            now = time.monotonic()
            if next_at > now:
                time.sleep(next_at - now)
            next_at = max(next_at + interval, now)
            yield document

    def migrate_document(self, document, retries):
        """
        Hand one document over, and return what the collaboration server said.

        Runs in a worker thread and touches no database: the results are
        written by the main thread, so the pool needs no connection of its own.
        """
        service = YHubService()

        for attempt in range(1, retries + 1):
            try:
                result = service.migrate(document)
            except YHubError as err:
                if attempt < retries and self.is_retryable(err):
                    # the server is unwell or busy, not this document
                    time.sleep(2**attempt)
                    continue

                logger.warning("document %s was not migrated: %s", document.pk, err)
                return models.DocumentMigration(
                    document_id=document.pk,
                    status=models.DocumentMigrationStatus.FAILED,
                    error=str(err)[:500],
                    updated_at=timezone.now(),
                )

            return models.DocumentMigration(
                document_id=document.pk,
                status=result.get("status", models.DocumentMigrationStatus.MIGRATED),
                versions=result.get("versions", 0),
                applied=result.get("applied", 0),
                skipped=result.get("skipped", 0),
                dropped=result.get("dropped", 0),
                duration_ms=result.get("durationMs", 0),
                updated_at=timezone.now(),
            )

        raise AssertionError(
            "unreachable: the loop returns or raises"
        )  # pragma: no cover

    @staticmethod
    def is_retryable(err):
        """
        Say whether handing the same document over again could go better.

        The collaboration server answers a 5xx or a 429 when it is unwell or
        busy, and any other 4xx about the document itself — which will not fix
        itself. Not reaching it at all is worth another try.
        """
        if not isinstance(err, APIError):
            return True

        return (
            err.status_code is None
            or err.status_code >= 500
            or err.status_code in RETRY_STATUSES
        )

    @staticmethod
    def save(migrations):
        """Record what became of these documents, replacing what a previous run said."""
        if not migrations:
            return

        models.DocumentMigration.objects.bulk_create(
            migrations,
            update_conflicts=True,
            update_fields=[
                "status",
                "versions",
                "applied",
                "skipped",
                "dropped",
                "duration_ms",
                "error",
                "updated_at",
            ],
            unique_fields=["document"],
        )
