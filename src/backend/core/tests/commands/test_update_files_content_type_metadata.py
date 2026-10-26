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


@pytest.mark.django_db
def test_update_files_content_type_metadata_keeps_content_disposition():
    """
    Unsafe attachments (SVG, HTML...) are stored with an "attachment" content
    disposition so browsers download them instead of rendering them. Fixing
    the ContentType must not drop it, or they would be served inline.
    """
    s3_client = default_storage.connection.meta.client
    bucket_name = default_storage.bucket_name

    doc_id = uuid.uuid4()
    factories.DocumentFactory(id=doc_id)
    key = f"{doc_id}/attachments/logo.svg"
    s3_client.put_object(
        Bucket=bucket_name,
        Key=key,
        Body=b'<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        ContentType="text/plain",
        ContentDisposition='attachment; filename="logo.svg"',
        Metadata={"is_unsafe": "true"},
    )

    call_command("update_files_content_type_metadata")

    head_resp = s3_client.head_object(Bucket=bucket_name, Key=key)
    assert head_resp["ContentType"] == "image/svg+xml"
    assert head_resp["ContentDisposition"] == 'attachment; filename="logo.svg"'
    assert head_resp["Metadata"].get("is_unsafe") == "true"
