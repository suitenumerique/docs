"""revoke_load_test_sessions — delete every session `create_load_test_sessions` minted.

The keys are read from the index kept next to the sessions, so the manifest is
not needed. Pass `--storage-name` to delete a manifest stored in the object
storage along the way.

    python manage.py revoke_load_test_sessions
    python manage.py revoke_load_test_sessions --storage-name campaign-1.json
"""

from django.core.management.base import BaseCommand, CommandError

from loadtest import manifests, sessions


class Command(BaseCommand):
    """Revoke the sessions of a load test."""

    help = __doc__

    def add_arguments(self, parser):
        """Define command arguments."""
        parser.add_argument(
            "--storage-name",
            help="Also delete this manifest from the default storage.",
        )

    def handle(self, *args, **options):
        """Revoke, and report counts."""
        try:
            revoked = sessions.revoke_all()
        except sessions.LoadTestToolsDisabled as error:
            raise CommandError(str(error)) from error
        self.stdout.write(f"{revoked} session(s) revoked.")

        if options["storage_name"] is not None:
            try:
                deleted = manifests.delete_storage(options["storage_name"])
            except ValueError as error:
                raise CommandError(str(error)) from error
            self.stdout.write(
                "Manifest deleted." if deleted else "No such manifest in the storage."
            )
