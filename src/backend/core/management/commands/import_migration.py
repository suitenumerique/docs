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

from core.models import Document, DocumentAccess, Invitation, LinkTrace, User


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
        # Maps source-instance document path → newly created Document node on
        # this instance. Used to resolve the parent when inserting a child: the
        # exported path is meaningless here (treebeard recomputes paths), but it
        # uniquely identifies the parent within a single import run.
        source_path_to_node = {}
        skipped_models = set()

        # Track the current model section to finalize progress lines cleanly
        # when the model label changes mid-stream.
        current_model = None

        total_entries = 0
        created_entries = 0

        for line in stream:
            line = line.strip()
            if not line:
                continue

            record = json.loads(line)
            model_label = record["model"]
            pk = record["pk"]
            fields = record["fields"]

            if model_label != current_model:  # Starting a new model section
                if current_model is not None:
                    self._progress(current_model, total_entries, done=True)
                    self._print_section_summary(
                        current_model, total_entries, created_entries
                    )

                total_entries = 0
                created_entries = 0
                current_model = model_label
                self.stderr.write(f"Importing {current_model}...")

            match model_label:
                case "core.user":
                    created = self._import_user(pk, fields, user_uuid_remap)
                case "core.document":
                    created = self._import_document(
                        pk, fields, user_uuid_remap, source_path_to_node
                    )
                case "core.documentaccess":
                    created = self._import_document_access(pk, fields, user_uuid_remap)
                case "core.invitation":
                    created = self._import_invitation(pk, fields, user_uuid_remap)
                case "core.linktrace":
                    created = self._import_link_trace(pk, fields, user_uuid_remap)
                case _:
                    if model_label not in skipped_models:
                        self.stderr.write(
                            f"  skipping {model_label} (not yet implemented)"
                        )
                        skipped_models.add(model_label)
                    continue

            total_entries += 1
            if created:
                created_entries += 1
            self._progress(model_label, total_entries)

        # Finalize the last section.
        self._progress(current_model, total_entries, done=True)
        self._print_section_summary(current_model, total_entries, created_entries)

    def _print_section_summary(self, model_label, total, created):
        """Print a one-line breakdown after each model section finishes."""
        skipped = total - created
        if model_label == "core.user":
            self.stderr.write(f"  {created} created, {skipped} remapped to existing")
        else:
            self.stderr.write(
                f"  {created} imported, {skipped} already existed (skipped)"
            )

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

    def _import_document(self, pk, fields, user_uuid_remap, source_path_to_node):
        """
        Import one document record.

        Returns True if a new row was created, False if the document already
        existed (matched by UUID) and was skipped.

        Documents are inserted via treebeard's add_root / add_child so that the
        materialized path is computed fresh for this instance. The source path
        from the export is only used as a transient key to resolve parent nodes
        within this import run; it is never written to the database.
        """
        source_path = fields.pop("path")

        # treebeard sets depth and recomputes path itself; passing exported
        # values would leave numchild wrong (add_child increments it per child,
        # so a non-zero starting value would produce double-counting).
        fields.pop("depth")
        fields.pop("numchild")

        # add_root / add_child call save(), which triggers Django's pre_save()
        # on every field. For fields with auto_now_add=True (created_at) and
        # auto_now=True (updated_at), pre_save() always overrides whatever value
        # we set with the current time — the exported timestamps would be lost.
        # We pop them here to keep the call clean, then restore the originals
        # with a direct UPDATE once the row exists, bypassing pre_save entirely.
        # (bulk_create, used for other models, does not call pre_save, so those
        # models don't need this workaround.)
        created_at = fields.pop("created_at")
        updated_at = fields.pop("updated_at")

        # creator_id is a FK to User. Users from the source instance may have
        # been remapped to a different UUID on this instance (when a user with
        # the same OIDC sub already existed here). Rewrite the FK so it points
        # to the correct local user.
        creator_id = fields.get("creator_id")
        if creator_id and creator_id in user_uuid_remap:
            fields["creator_id"] = user_uuid_remap[creator_id]

        # duplicated_from_id points to another Document that this one was
        # duplicated from (the "Duplicate document" feature). It is a nullable
        # self-referential FK. Documents are exported ordered by tree path, so a
        # document that was duplicated from a node in a different branch may
        # appear before its source in the file, causing a FK constraint failure
        # on insert. Clearing it here is safe because this field is purely
        # informational; restoring it would require a second pass over all rows.
        fields["duplicated_from_id"] = None

        existing = Document.objects.filter(id=pk).first()
        if existing:
            # Already imported (re-run): register in the path map so that any
            # children that follow can still resolve their parent.
            source_path_to_node[source_path] = existing
            return False

        # Document.steplen is the fixed number of characters treebeard uses per
        # tree level in the materialized path (e.g. 7 means each node occupies
        # exactly 7 characters). Trimming the last steplen characters from a
        # path gives the parent's path; a path of exactly steplen characters has
        # no parent and is a root node.
        parent_source_path = (
            source_path[: -Document.steplen]
            if len(source_path) > Document.steplen
            else None
        )

        if parent_source_path is None:
            node = Document.add_root(**fields, id=pk)
        else:
            node = source_path_to_node[parent_source_path].add_child(**fields, id=pk)

        # Restore the original timestamps now that the row exists.
        Document.objects.filter(id=pk).update(
            created_at=created_at, updated_at=updated_at
        )

        source_path_to_node[source_path] = node
        return True

    def _import_document_access(self, pk, fields, user_uuid_remap):
        """
        Import one document access record.

        Returns True if a new row was created, False if it already existed.
        """
        # user_id is a nullable FK to User (team-based accesses have no user).
        # Remap to the local UUID when the source user was matched to an
        # existing account during the user import phase.
        user_id = fields.get("user_id")
        if user_id and user_id in user_uuid_remap:
            fields["user_id"] = user_uuid_remap[user_id]

        if DocumentAccess.objects.filter(id=pk).exists():
            return False

        # bulk_create bypasses save() entirely, which has two benefits here:
        # - DocumentAccess.save() clears a per-document cache; skipping it
        #   avoids unnecessary cache invalidation during import.
        # - pre_save() is not called, so auto_now/auto_now_add on created_at
        #   and updated_at are not triggered — the exported timestamps are
        #   preserved as-is without needing a post-save UPDATE.
        DocumentAccess.objects.bulk_create([DocumentAccess(**fields, id=pk)])
        return True

    def _import_invitation(self, pk, fields, user_uuid_remap):
        """
        Import one invitation record.

        Returns True if a new row was created, False if it already existed.

        Invitation.clean() rejects emails that already belong to a registered
        user. bulk_create bypasses clean(), which is intentional: we are
        restoring historical data as-is, not validating new invitations.
        """
        # issuer_id is a nullable FK to User; remap to the local UUID when the
        # source user was matched to an existing account during user import.
        issuer_id = fields.get("issuer_id")
        if issuer_id and issuer_id in user_uuid_remap:
            fields["issuer_id"] = user_uuid_remap[issuer_id]

        if Invitation.objects.filter(id=pk).exists():
            return False

        Invitation.objects.bulk_create([Invitation(**fields, id=pk)])
        return True

    def _import_link_trace(self, pk, fields, user_uuid_remap):
        """
        Import one link trace record.

        Returns True if a new row was created, False if it already existed.

        LinkTrace records which logged-in users have accessed a document via a
        shared link. They make the document appear in the user's document list
        even when the user has no explicit role on it.
        """
        user_id = fields.get("user_id")
        if user_id and user_id in user_uuid_remap:
            fields["user_id"] = user_uuid_remap[user_id]

        if LinkTrace.objects.filter(id=pk).exists():
            return False

        LinkTrace.objects.bulk_create([LinkTrace(**fields, id=pk)])
        return True

