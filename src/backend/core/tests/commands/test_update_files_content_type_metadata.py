"""
Unit test for `update_files_content_type_metadata` command.
"""

import uuid

from django.core.files.storage import default_storage
from django.core.management import call_command

import pytest

from core import factories


@pytest.mark.django_db
def test_update_files_content_type_metadata():
    """
    Test that the command `update_files_content_type_metadata`
    fixes the ContentType of attachment in the storage.
    """
    s3_client = default_storage.connection.meta.client
    bucket_name = default_storage.bucket_name

    # Create files with a wrong ContentType
    keys = []
    for _ in range(10):
        doc_id = uuid.uuid4()
        factories.DocumentFactory(id=doc_id)
        key = f"{doc_id}/attachments/testfile.png"
        keys.append(key)
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR..."
        s3_client.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=fake_png,
            ContentType="text/plain",
            Metadata={"owner": "None"},
        )

    # Call the command that fixes the ContentType
    call_command("update_files_content_type_metadata")

    for key in keys:
        head_resp = s3_client.head_object(Bucket=bucket_name, Key=key)
        assert head_resp["ContentType"] == "image/png", (
            f"ContentType not fixed, got {head_resp['ContentType']!r}"
        )

        # Check that original metadata was preserved
        assert head_resp["Metadata"].get("owner") == "None"
