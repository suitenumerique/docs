"""Management command updating the metadata for all the files in the MinIO bucket."""

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

import magic

from core.models import Document

# pylint: disable=too-many-locals, broad-exception-caught


class Command(BaseCommand):
    """Update the metadata for all the files in the MinIO bucket."""

    help = __doc__

    def handle(self, *args, **options):
        """Execute management command."""
        s3_client = default_storage.connection.meta.client
        bucket_name = default_storage.bucket_name

        mime_detector = magic.Magic(mime=True)

        documents = Document.objects.all()
        self.stdout.write(
            f"[INFO] Found {documents.count()} documents. Starting ContentType fix..."
        )

        for doc in documents:
            doc_id_str = str(doc.id)
            prefix = f"{doc_id_str}/attachments/"
            self.stdout.write(
                f"[INFO] Processing attachments under prefix '{prefix}' ..."
            )

            continuation_token = None
            total_updated = 0

            while True:
                list_kwargs = {"Bucket": bucket_name, "Prefix": prefix}
                if continuation_token:
                    list_kwargs["ContinuationToken"] = continuation_token

                response = s3_client.list_objects_v2(**list_kwargs)

                # If no objects found under this prefix, break out of the loop
                if "Contents" not in response:
                    break

                for obj in response["Contents"]:
                    key = obj["Key"]

                    # Skip if it's a folder
                    if key.endswith("/"):
                        continue

                    try:
                        # Get existing metadata
                        head_resp = s3_client.head_object(Bucket=bucket_name, Key=key)

                        # Read first ~1KB for MIME detection
                        partial_obj = s3_client.get_object(
                            Bucket=bucket_name, Key=key, Range="bytes=0-1023"
                        )
                        partial_data = partial_obj["Body"].read()

                        # Detect MIME type
                        magic_mime_type = mime_detector.from_buffer(partial_data)

                        # Update ContentType
                        s3_client.copy_object(
                            Bucket=bucket_name,
                            CopySource={"Bucket": bucket_name, "Key": key},
                            Key=key,
                            ContentType=magic_mime_type,
                            Metadata=head_resp.get("Metadata", {}),
                            MetadataDirective="REPLACE",
                        )
                        total_updated += 1

                    except Exception as exc:  # noqa
                        self.stderr.write(
                            f"[ERROR] Could not update ContentType for {key}: {exc}"
                        )

                if response.get("IsTruncated"):
                    continuation_token = response.get("NextContinuationToken")
                else:
                    break

            if total_updated > 0:
                self.stdout.write(
                    f"[INFO] -> Updated {total_updated} objects for Document {doc_id_str}."
                )
