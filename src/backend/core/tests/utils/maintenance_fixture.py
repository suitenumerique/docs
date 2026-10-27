"""
The batch recovery fixture (`core/tests/data/maintenance_escrow/`, written by
`src/frontend/apps/e2e/maintenance-fixture/generate.mts` with the encryption
service's code): documents encrypted exactly as Docs stores them, escrowed for the
encryption service's development maintenance key, and what they decrypt to.

`seed_maintenance_fixture` loads it into the database and the bucket for an owner,
from pytest or from a running backend, as the opt-in browser test does:

    python manage.py shell -c "from core.tests.utils.maintenance_fixture import \
seed_maintenance_fixture; seed_maintenance_fixture('user.test@chromium.test')"

Not a test module: pytest collects nothing here.
"""

import base64
import json
from pathlib import Path

from django.core.files.storage import default_storage

from core import models
from core.api.utils import attachment_upload_target

FIXTURE = Path(__file__).resolve().parents[1] / "data" / "maintenance_escrow"

# The owner's own wrapped key cannot be made ahead of time (it needs the owner's
# public key); the batch recovery never reads it, and the import drops it.
PLACEHOLDER_USER_KEY = base64.b64encode(b"not a wrap: seeded by the fixture").decode()


def load_fixture():
    """The fixture's description: phrase, fingerprint, documents."""
    return json.loads((FIXTURE / "fixture.json").read_text(encoding="utf-8"))


def stored_bytes(key):
    """An object of the fixture as the bucket holds it, encrypted."""
    return (FIXTURE / "objects" / key).read_bytes()


def plaintext_bytes(key):
    """What the maintenance tool decrypts an object of the fixture to."""
    return (FIXTURE / "plaintext" / key).read_bytes()


def remove_maintenance_fixture():
    """
    The fixture's documents gone, rows and every object under their ids, all
    versions: what a seed, an export, an import or a failed run left.
    """
    client, bucket = default_storage.connection.meta.client, default_storage.bucket_name
    ids = [document["id"] for document in load_fixture()["documents"]]

    models.Document.objects.filter(pk__in=ids).delete()
    models.MaintenanceImportUpload.objects.filter(document_id__in=ids).delete()

    for document_id in ids:
        paginator = client.get_paginator("list_object_versions")

        for page in paginator.paginate(Bucket=bucket, Prefix=f"{document_id}/"):
            for version in [*page.get("Versions", []), *page.get("DeleteMarkers", [])]:
                client.delete_object(
                    Bucket=bucket, Key=version["Key"], VersionId=version["VersionId"]
                )


def seed_maintenance_fixture(owner):
    """
    The fixture's documents, created by `owner` (a user, or the email of one) and
    owned by them, encrypted with their maintenance copies, content and attachments
    in the bucket as the frontend stores them. Replaces any earlier seed. Returns the
    documents.
    """
    if isinstance(owner, str):
        owner = models.User.objects.get(email=owner)

    remove_maintenance_fixture()
    client, bucket = default_storage.connection.meta.client, default_storage.bucket_name
    documents = []

    for line in load_fixture()["documents"]:
        document = models.Document.add_root(
            instance=models.Document(
                id=line["id"],
                title=line["title"],
                creator=owner,
                link_reach=models.LinkReachChoices.RESTRICTED,
                is_encrypted=True,
                maintenance_wrapped_document_key=line["maintenanceKey"],
                attachments=[attachment["key"] for attachment in line["attachments"]],
            )
        )
        client.put_object(
            Bucket=bucket, Key=document.file_key, Body=stored_bytes(document.file_key)
        )

        for attachment in line["attachments"]:
            # Stored as the upload endpoint stores an encrypted file.
            _, extra_args = attachment_upload_target(
                document,
                {
                    "is_encrypted": True,
                    "content_type": "application/octet-stream",
                    "is_unsafe": False,
                    "expected_extension": attachment["key"].rpartition(".")[-1],
                    "file_name": attachment["fileName"],
                },
                owner.id,
            )
            client.put_object(
                Bucket=bucket,
                Key=attachment["key"],
                Body=stored_bytes(attachment["key"]),
                **extra_args,
            )

        models.DocumentAccess.objects.create(
            document=document,
            user=owner,
            role=models.RoleChoices.OWNER,
            encrypted_document_symmetric_key_for_user=PLACEHOLDER_USER_KEY,
            encryption_public_key_version=1,
        )
        documents.append(document)

    return documents
