"""Clean a document by resetting it (keeping its title) and deleting all descendants."""

import logging

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from botocore.exceptions import ClientError

from core.choices import LinkReachChoices, LinkRoleChoices, RoleChoices
from core.models import (
    Document,
    DocumentAccess,
    DocumentAskForAccess,
    DocumentFavorite,
    Invitation,
    LinkTrace,
    Thread,
)

logger = logging.getLogger("impress.commands.clean_document")


class Command(BaseCommand):
    """Reset a document (keeping its title) and delete all its descendants."""

    help = __doc__

    def add_arguments(self, parser):
        """Define command arguments."""
        parser.add_argument(
            "document_id",
            type=str,
            help="UUID of the document to clean",
        )
        parser.add_argument(
            "-f",
            "--force",
            action="store_true",
            default=False,
            help="Force command execution despite DEBUG is set to False",
        )
        parser.add_argument(
            "-t",
            "--title",
            type=str,
            default=None,
            help="Update the document title to this value",
        )
        parser.add_argument(
            "--link_reach",
            type=str,
            default=LinkReachChoices.RESTRICTED,
            choices=LinkReachChoices,
            help="Update the link_reach to this value",
        )
        parser.add_argument(
            "--link_role",
            type=str,
            default=LinkRoleChoices.READER,
            choices=LinkRoleChoices,
            help="update the link_role to this value",
        )

    def handle(self, *args, **options):
        """Execute the clean_document command."""
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "This command is not meant to be used in production environment "
                "except you know what you are doing, if so use --force parameter"
            )

        document_id = options["document_id"]

        try:
            document = Document.objects.get(pk=document_id)
        except (Document.DoesNotExist, ValueError) as err:
            raise CommandError(f"Document {document_id} does not exist.") from err

        descendants = list(document.get_descendants())
        descendant_ids = [doc.id for doc in descendants]
        all_documents = [document, *descendants]

        # Collect all attachment keys before the transaction clears them
        all_attachment_keys = []
        for doc in all_documents:
            all_attachment_keys.extend(doc.attachments)

        self.stdout.write(
            f"Cleaning document {document_id} and deleting "
            f"{len(descendants)} descendant(s)..."
        )

        with transaction.atomic():
            self._clean_root_relations(document)

            # Reset root document fields. We use save() rather than a queryset
            # update() so the post_save signal fires (search re-indexation) and
            # `updated_at` is refreshed. All descendants are about to be deleted,
            # so the document can no longer have any deleted child either.
            document.excerpt = None
            document.link_reach = options["link_reach"]
            document.link_role = options["link_role"]
            document.attachments = []
            document.has_deleted_children = False
            if options["title"] is not None:
                document.title = options["title"]
            document.save()

            if options["title"] is not None:
                self.stdout.write(
                    f'Reset fields on root document (title set to "{options["title"]}").'
                )
            else:
                self.stdout.write("Reset fields on root document (title kept).")

            # Delete all descendants (cascades accesses and invitations)
            if descendants:
                deleted_count, _ = Document.objects.filter(
                    id__in=descendant_ids
                ).delete()
                self.stdout.write(f"Deleted {deleted_count} descendant(s).")

        # Delete S3 content outside the transaction (S3 is not transactional)
        bucket = default_storage.bucket

        for doc in all_documents:
            try:
                self._purge_object(bucket, doc.file_key)
            except ClientError:
                logger.warning("Failed to delete S3 file for document %s", doc.id)

        self.stdout.write(f"Deleted S3 content for {len(all_documents)} document(s).")

        for key in all_attachment_keys:
            try:
                self._purge_object(bucket, key)
            except ClientError:
                logger.warning("Failed to delete S3 attachment %s", key)

        self.stdout.write(f"Deleted {len(all_attachment_keys)} attachment(s) from S3.")
        self.stdout.write("Done.")

    def _clean_root_relations(self, document):
        """
        Delete the relations attached to the root document: accesses (except
        owners), invitations, threads, favorites, link traces and pending
        access requests.
        """
        access_count, _ = DocumentAccess.objects.filter(
            Q(document_id=document.id) & ~Q(role=RoleChoices.OWNER)
        ).delete()
        self.stdout.write(f"Deleted {access_count} access(es) on root document.")

        for model, label in (
            (Invitation, "invitation"),
            (Thread, "thread"),
            (DocumentFavorite, "favorite"),
            (LinkTrace, "link trace"),
            (DocumentAskForAccess, "pending access request"),
        ):
            count, _ = model.objects.filter(document_id=document.id).delete()
            self.stdout.write(f"Deleted {count} {label}(s) on root document.")

    @staticmethod
    def _purge_object(bucket, key):
        """
        Permanently delete every version and delete-marker of a single object.

        The media bucket is versioned, so a plain ``delete`` would only add a
        delete-marker and leave the content retrievable. Filtering the bucket's
        ``object_versions`` collection on the key and deleting it removes all
        stored versions at once.
        """
        bucket.object_versions.filter(Prefix=key).delete()
