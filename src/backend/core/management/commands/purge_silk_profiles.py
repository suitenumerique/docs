"""purge_silk_profiles — delete django-silk ``.prof`` binaries from object storage.

django-silk writes a binary cProfile per intercepted request through the
``SILKY_STORAGE`` backend (S3, under the ``silk/`` prefix — see settings). Its
ring-buffer (``SILK_MAX_RECORDED_REQUESTS``) prunes the *database* rows once the
cap is exceeded, but it does NOT delete the corresponding object-storage files,
so ``.prof`` binaries accumulate indefinitely. This command reclaims that space.

By default it deletes only **orphans** — ``.prof`` objects no longer referenced
by any ``silk.Request`` row — which is always safe. ``--all`` blind-purges every
profile under the prefix (the only mode available when silk is disabled, since
there are then no DB rows to compare against). ``--older-than DAYS`` further
restricts deletion by object age.

Everything goes through Django's storage API (``storages['SILKY_STORAGE']``), so
it works on read-only/ephemeral Kubernetes pods with no local filesystem.

    python manage.py purge_silk_profiles --dry-run          # preview orphans
    python manage.py purge_silk_profiles                    # delete orphans
    python manage.py purge_silk_profiles --all              # wipe every profile
    python manage.py purge_silk_profiles --older-than 7     # only >7 days old
"""

from django.apps import apps
from django.core.files.storage import storages
from django.core.files.storage.handler import InvalidStorageError
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

SILK_STORAGE_ALIAS = "SILKY_STORAGE"


class Command(BaseCommand):
    """Delete orphaned (or all) django-silk profile binaries from storage."""

    help = __doc__

    def add_arguments(self, parser):
        """Define command arguments."""
        parser.add_argument(
            "--all",
            action="store_true",
            help="Delete every .prof under the prefix, not just orphaned ones.",
        )
        parser.add_argument(
            "--older-than",
            type=int,
            default=None,
            metavar="DAYS",
            help="Only delete profiles whose object is older than DAYS days.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List what would be deleted; delete nothing.",
        )

    def handle(self, *args, **options):
        """List the profile store and delete the targeted objects."""
        try:
            storage = storages[SILK_STORAGE_ALIAS]
        except InvalidStorageError as err:
            raise CommandError(
                f"No '{SILK_STORAGE_ALIAS}' entry in the STORAGES setting; "
                "cannot locate the silk profile store."
            ) from err

        purge_all = options["all"]
        dry_run = options["dry_run"]

        referenced = set() if purge_all else self._referenced_prof_files()

        cutoff = None
        if options["older_than"] is not None:
            cutoff = timezone.now() - timezone.timedelta(days=options["older_than"])

        try:
            _dirs, files = storage.listdir("")
        except FileNotFoundError:
            files = []

        profiles = [name for name in files if name.endswith(".prof")]
        self.stdout.write(f"Found {len(profiles)} profile object(s) in storage.")

        deleted = kept = 0
        for name in profiles:
            if not purge_all and name in referenced:
                kept += 1
                continue
            if cutoff is not None and storage.get_modified_time(name) >= cutoff:
                kept += 1
                continue
            if dry_run:
                self.stdout.write(f"  would delete {name}")
                deleted += 1
                continue
            storage.delete(name)
            deleted += 1

        verb = "would delete" if dry_run else "deleted"
        self.stdout.write(
            self.style.SUCCESS(
                f"\n{verb} {deleted} profile(s); kept {kept} "
                f"({'referenced/recent' if not purge_all else 'recent'})."
            )
        )

    def _referenced_prof_files(self):
        """Return the set of prof_file names still referenced by silk.Request.

        Requires the silk app to be installed (SILK_ENABLED). Without it there
        are no rows to compare against, so orphan detection is impossible and the
        caller must use --all instead.
        """
        if not apps.is_installed("silk"):
            raise CommandError(
                "The silk app is not installed (SILK_ENABLED is off), so orphaned "
                "profiles cannot be identified. Re-run with --all to blind-purge "
                "every profile under the prefix, or set SILK_ENABLED=1 to compute "
                "orphans against the silk.Request table."
            )

        request_model = apps.get_model("silk", "Request")
        return set(
            request_model.objects.exclude(prof_file="").values_list(
                "prof_file", flat=True
            )
        )
