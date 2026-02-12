"""Clean a document by resetting it (keeping its title) and deleting all descendants."""

import logging

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from botocore.exceptions import ClientError

from core.choices import LinkReachChoices, LinkRoleChoices, RoleChoices
from core.models import Document, DocumentAccess, Invitation, Thread

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
            # Clean accesses and invitations on the root document
            access_count, _ = DocumentAccess.objects.filter(
                Q(document_id=document.id) & ~Q(role=RoleChoices.OWNER)
            ).delete()
            self.stdout.write(f"Deleted {access_count} access(es) on root document.")

            invitation_count, _ = Invitation.objects.filter(
                document_id=document.id
            ).delete()
            self.stdout.write(
                f"Deleted {invitation_count} invitation(s) on root document."
            )

            thread_count, _ = Thread.objects.filter(document_id=document.id).delete()
            self.stdout.write(f"Deleted {thread_count} thread(s) on root document.")

            # Reset root document fields
            update_fields = {
                "excerpt": None,
                "link_reach": options["link_reach"],
                "link_role": options["link_role"],
                "attachments": [],
            }
            if options["title"] is not None:
                update_fields["title"] = options["title"]
            Document.objects.filter(id=document.id).update(**update_fields)

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
        s3_client = default_storage.connection.meta.client
        bucket = default_storage.bucket_name

        for doc in all_documents:
            try:
                s3_client.delete_object(Bucket=bucket, Key=doc.file_key)
            except ClientError:
                logger.warning("Failed to delete S3 file for document %s", doc.id)

        self.stdout.write(f"Deleted S3 content for {len(all_documents)} document(s).")

        for key in all_attachment_keys:
            try:
                s3_client.delete_object(Bucket=bucket, Key=key)
            except ClientError:
                logger.warning("Failed to delete S3 attachment %s", key)

        self.stdout.write(f"Deleted {len(all_attachment_keys)} attachment(s) from S3.")
        self.stdout.write("Done.")
