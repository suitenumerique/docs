"""import_migration — import data from a JSONL migration export.

Each input line must be a self-contained JSON object of the following pattern,
and be in dependency order:

    {"model": "<app_label>.<model>", "pk": "<uuid>", "fields": { ... }}

Such a file can be produced by the export_migration management command.

Unknown model labels are skipped with a one-time warning.

Note: this script was written to be run from a version 5.2.1 or above.

Usage:
    python manage.py import_migration migration.jsonl

Or, to pipe from stdin, for example if running the command through docker:
    docker compose exec -T app-dev python manage.py import_migration < data_export.jsonl
"""

import json
import sys

from django.core.management.base import BaseCommand

from core.models import (
    Comment,
    Document,
    DocumentAccess,
    DocumentAskForAccess,
    DocumentFavorite,
    Invitation,
    LinkTrace,
    Mention,
    Reaction,
    Thread,
    User,
    UserReconciliation,
    UserReconciliationCsvImport,
)


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

        for raw_line in stream:
            line = raw_line.strip()
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

            created = self._dispatch_record(
                model_label, pk, fields, user_uuid_remap, source_path_to_node
            )
            if created is None:
                # Unknown model label: warn once and skip.
                if model_label not in skipped_models:
                    self.stderr.write(f"  skipping {model_label} (not yet implemented)")
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

    def _dispatch_record(
        self, model_label, pk, fields, user_uuid_remap, source_path_to_node
    ):
        """
        Route one JSONL record to the appropriate import method.

        Returns True if a new row was created, False if it already existed, or
        None if the model label is not recognised.
        """
        # Each handler is a callable(pk, fields) — extra arguments are closed
        # over so every entry has the same signature.
        handlers = {
            "core.user": lambda pk, fields: self._import_user(
                pk, fields, user_uuid_remap
            ),
            "core.document": lambda pk, fields: self._import_document(
                pk, fields, user_uuid_remap, source_path_to_node
            ),
            "core.documentaccess": lambda pk, fields: self._import_document_access(
                pk, fields, user_uuid_remap
            ),
            "core.invitation": lambda pk, fields: self._import_invitation(
                pk, fields, user_uuid_remap
            ),
            "core.linktrace": lambda pk, fields: self._import_link_trace(
                pk, fields, user_uuid_remap
            ),
            "core.documentaskforaccess": lambda pk, fields: (
                self._import_document_ask_for_access(pk, fields, user_uuid_remap)
            ),
            "core.documentfavorite": lambda pk, fields: self._import_document_favorite(
                pk, fields, user_uuid_remap
            ),
            "core.userreconciliation": lambda pk, fields: (
                self._import_user_reconciliation(pk, fields, user_uuid_remap)
            ),
            "core.userreconciliationcsvimport": self._import_user_reconciliation_csv_import,
            "core.thread": lambda pk, fields: self._import_thread(
                pk, fields, user_uuid_remap
            ),
            "core.comment": lambda pk, fields: self._import_comment(
                pk, fields, user_uuid_remap
            ),
            "core.reaction": self._import_reaction,
            "core.reaction_users": lambda pk, fields: self._import_reaction_users(
                pk, fields, user_uuid_remap
            ),
            "core.mention": lambda pk, fields: self._import_mention(
                pk, fields, user_uuid_remap
            ),
        }
        handler = handlers.get(model_label)
        if handler is None:
            return None
        return handler(pk, fields)

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

    def _import_document_ask_for_access(self, pk, fields, user_uuid_remap):
        """
        Import one ask-for-access record.

        Returns True if a new row was created, False if it already existed.

        DocumentAskForAccess records a user's request to be granted a role on a
        document they cannot currently access. Owners/admins see these requests
        and can accept or reject them.
        """
        user_id = fields.get("user_id")
        if user_id and user_id in user_uuid_remap:
            fields["user_id"] = user_uuid_remap[user_id]

        if DocumentAskForAccess.objects.filter(id=pk).exists():
            return False

        DocumentAskForAccess.objects.bulk_create(
            [DocumentAskForAccess(**fields, id=pk)]
        )
        return True

    def _import_document_favorite(self, pk, fields, user_uuid_remap):
        """
        Import one document favorite record.

        Returns True if a new row was created, False if it already existed.
        """
        user_id = fields.get("user_id")
        if user_id and user_id in user_uuid_remap:
            fields["user_id"] = user_uuid_remap[user_id]

        if DocumentFavorite.objects.filter(id=pk).exists():
            return False

        DocumentFavorite.objects.bulk_create([DocumentFavorite(**fields, id=pk)])
        return True

    def _import_thread(self, pk, fields, user_uuid_remap):
        """
        Import one thread record.

        Returns True if a new row was created, False if it already existed.

        A thread groups one or more comments on a document. It carries two
        nullable user FKs: creator_id (who opened the thread) and
        resolved_by_id (who resolved it, if resolved).
        """
        for field in ("creator_id", "resolved_by_id"):
            user_id = fields.get(field)
            if user_id and user_id in user_uuid_remap:
                fields[field] = user_uuid_remap[user_id]

        if Thread.objects.filter(id=pk).exists():
            return False

        Thread.objects.bulk_create([Thread(**fields, id=pk)])
        return True

    def _import_comment(self, pk, fields, user_uuid_remap):
        """
        Import one comment record.

        Returns True if a new row was created, False if it already existed.

        Comments must be imported after their parent thread (export_migration
        guarantees this ordering).
        """
        user_id = fields.get("user_id")
        if user_id and user_id in user_uuid_remap:
            fields["user_id"] = user_uuid_remap[user_id]

        if Comment.objects.filter(id=pk).exists():
            return False

        Comment.objects.bulk_create([Comment(**fields, id=pk)])
        return True

    def _import_reaction(self, pk, fields):
        """
        Import one reaction record (the emoji + comment row, without users).

        Returns True if a new row was created, False if it already existed.

        Reactions have no direct user FK — the reacting users are stored in the
        M2M through table, exported separately as core.reaction_users and
        imported by _import_reaction_users.
        """
        if Reaction.objects.filter(id=pk).exists():
            return False

        Reaction.objects.bulk_create([Reaction(**fields, id=pk)])
        return True

    def _import_reaction_users(self, pk, fields, user_uuid_remap):
        """
        Import one row from the Reaction.users M2M through table.

        Returns True if a new row was created, False if it already existed.

        Each row links one Reaction to one User. The user_id needs remapping
        when the source user was matched to a different local UUID during user
        import.
        """
        user_id = fields.get("user_id")
        if user_id and user_id in user_uuid_remap:
            fields["user_id"] = user_uuid_remap[user_id]

        ReactionUsers = Reaction.users.through
        if ReactionUsers.objects.filter(id=pk).exists():
            return False

        ReactionUsers.objects.bulk_create([ReactionUsers(**fields, id=pk)])
        return True

    def _import_user_reconciliation(self, pk, fields, user_uuid_remap):
        """
        Import one user reconciliation record.

        Returns True if a new row was created, False if it already existed.

        UserReconciliation tracks admin-initiated requests to merge two accounts
        (an active and an inactive one) into a single user. It carries two
        nullable user FKs: active_user_id and inactive_user_id, both of which
        may need remapping.
        """
        for field in ("active_user_id", "inactive_user_id"):
            user_id = fields.get(field)
            if user_id and user_id in user_uuid_remap:
                fields[field] = user_uuid_remap[user_id]

        if UserReconciliation.objects.filter(id=pk).exists():
            return False

        UserReconciliation.objects.bulk_create([UserReconciliation(**fields, id=pk)])
        return True

    def _import_user_reconciliation_csv_import(self, pk, fields):
        """
        Import one user reconciliation CSV import record.

        Returns True if a new row was created, False if it already existed.

        UserReconciliationCsvImport holds metadata about a batch CSV file that
        was used to feed reconciliation requests. It has no user FK, only a
        FileField pointing to the uploaded CSV in object storage. The file path
        is preserved as-is from the export; the actual file bytes are not moved
        by this script.
        """
        if UserReconciliationCsvImport.objects.filter(id=pk).exists():
            return False

        UserReconciliationCsvImport.objects.bulk_create(
            [UserReconciliationCsvImport(**fields, id=pk)]
        )
        return True

    def _import_mention(self, pk, fields, user_uuid_remap):
        """
        Import one mention record.

        Returns True if a new row was created, False if it already existed.

        A Mention is created whenever a user is @-mentioned in a document body
        or in a comment thread. It carries two user FKs: mentioned_user_id
        (nullable — the mentioned person) and mentioned_by_user_id (the author
        of the mention, non-nullable). Both may need remapping.
        """
        for field in ("mentioned_user_id", "mentioned_by_user_id"):
            user_id = fields.get(field)
            if user_id and user_id in user_uuid_remap:
                fields[field] = user_uuid_remap[user_id]

        if Mention.objects.filter(id=pk).exists():
            return False

        Mention.objects.bulk_create([Mention(**fields, id=pk)])
        return True
