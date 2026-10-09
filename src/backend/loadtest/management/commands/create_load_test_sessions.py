"""create_load_test_sessions — log synthetic users in, for a load test.

Only available with the `LoadTest` configuration. It writes, straight to the
session store, the sessions an OIDC login would have opened for existing users,
and a manifest telling a load generator which cookie to send and which documents
each of those users may open:

    {
      "cookie_name": "docs_sessionid", "created_at": …, "expires_at": …,
      "public_documents": ["<document id>", …],
      "sessions": [
        {"user_id": …, "session_key": …,
         "editable_documents": […], "readonly_documents": […]}, …
      ]
    }

The manifest holds live session keys: it is a secret. It goes to a file only its
owner can read (`--output`) or to a private object of the storage
(`--storage-name`, under `loadtest/`), never to the output of this command.

    python manage.py create_load_test_sessions 1000 --output /tmp/manifest.json
    python manage.py create_load_test_sessions 5000 --heaviest 50 \\
        --storage-name campaign-1.json --ttl-hours 8

Use one virtual user per session: the API throttles per user. Revoke everything
with `revoke_load_test_sessions` once the campaign is over.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError

from loadtest import manifests, sessions


class Command(BaseCommand):
    """Mint the sessions of a load test and write their manifest."""

    help = __doc__

    def add_arguments(self, parser):
        """Define command arguments."""
        parser.add_argument("count", type=int, help="Number of users to log in.")
        parser.add_argument(
            "--heaviest",
            type=int,
            default=0,
            help="How many of them are the users holding the most accesses, "
            "instead of a random draw (default: 0).",
        )
        parser.add_argument(
            "--documents-per-user",
            type=int,
            default=20,
            help="Editable and read-only documents listed per user (default: 20 each).",
        )
        parser.add_argument(
            "--public-documents",
            type=int,
            default=100,
            help="Public documents listed for everybody (default: 100).",
        )
        parser.add_argument(
            "--ttl-hours",
            type=float,
            default=12,
            help="Lifetime of the sessions, in hours (default: 12, at most 168).",
        )
        destination = parser.add_mutually_exclusive_group(required=True)
        destination.add_argument(
            "--output", help="File to write the manifest to (created with mode 0600)."
        )
        destination.add_argument(
            "--storage-name",
            help="Name of the object to write the manifest to, under "
            f"`{manifests.STORAGE_PREFIX}` in the default storage.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Replace the manifest when it already exists.",
        )

    def handle(self, *args, **options):
        """Mint the sessions, write the manifest, report counts and nothing else."""
        try:
            sessions.ensure_enabled()
        except sessions.LoadTestToolsDisabled as error:
            raise CommandError(str(error)) from error

        if options["count"] < 1:
            raise CommandError("count must be at least 1.")
        ttl = timedelta(hours=options["ttl_hours"])
        if ttl <= timedelta(0) or ttl > sessions.MAX_TTL:
            raise CommandError(
                f"--ttl-hours must be above 0 and at most {sessions.MAX_TTL.days * 24}."
            )
        if options["storage_name"] is not None:
            try:
                manifests.storage_key(options["storage_name"])
            except ValueError as error:
                raise CommandError(str(error)) from error

        manifest = sessions.build_manifest(
            options["count"],
            heaviest=options["heaviest"],
            documents_per_user=options["documents_per_user"],
            nb_public_documents=options["public_documents"],
            ttl=ttl,
        )

        try:
            if options["storage_name"] is None:
                manifests.write_file(options["output"], manifest, options["force"])
                destination = options["output"]
            else:
                destination = manifests.write_storage(
                    options["storage_name"], manifest, options["force"]
                )
        except FileExistsError as error:
            # the sessions exist and nobody holds their keys: take them back
            sessions.revoke_all()
            raise CommandError(
                f"{error.filename or error} already exists, use --force to replace "
                "it. The sessions that were just minted have been revoked."
            ) from error

        minted = len(manifest["sessions"])
        self.stdout.write(
            f"{minted} session(s) minted, valid until {manifest['expires_at']}. "
            f"Manifest written to {destination}."
        )
        if minted < options["count"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Only {minted} of the {options['count']} requested users are "
                    "active, not staff, and hold an access to a live document."
                )
            )
