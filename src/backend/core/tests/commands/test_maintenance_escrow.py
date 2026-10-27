"""
Tests for the batch recovery commands `maintenance_export`, `maintenance_import` and
`maintenance_purge_versions`, against the real object storage: the export the
maintenance tool reads, then its decrypted output written back.
"""
# pylint: disable=too-many-lines

import base64
import json
import os
import uuid
from io import StringIO
from unittest import mock

from django.core.files.storage import default_storage
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils.http import content_disposition_header

import pycrdt
import pytest

from core import enums, factories, models
from core.utils.maintenance_escrow import is_plain_yjs
from core.utils.maintenance_escrow import object_versions as listed_versions

pytestmark = pytest.mark.django_db

AGRICULTURE = "0123456789abcdef0123456789abcdef"
INTERIEUR = "fedcba9876543210fedcba9876543210"


def fingerprint_of(key_id):
    """The 40 digits the tool shows for a key id: the scheme digit, then the id as a number."""
    return "1" + str(int(key_id, 16)).zfill(39)


PLAIN_CONTENT = factories.YDOC_HELLO_WORLD_BASE64
# Ciphertext is random-looking bytes: never a Yjs update.
CIPHERTEXT = os.urandom(64)
CIPHERTEXT_EDITED = os.urandom(64)
# A real PNG, one pixel: its type is detected from its bytes, as on any upload.
PLAIN_IMAGE = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQ"
    "GAhKmMIQAAAABJRU5ErkJggg=="
)
MEDIA_URL = "http://localhost:8083/media/"


def client_and_bucket():
    """The storage the documents live in."""
    return default_storage.connection.meta.client, default_storage.bucket_name


def maintenance_copy(key_id):
    """A maintenance copy as the vault writes it: version, key id, then the wrap."""
    return base64.b64encode(
        bytes([1]) + bytes.fromhex(key_id) + os.urandom(48)
    ).decode()


def put_attachment(document, data, encrypted=True, name="facture.png"):
    """An attachment as the upload endpoint stores it, listed on the document."""
    client, bucket = client_and_bucket()
    key = f"{document.key_base}/attachments/{uuid.uuid4()}.png"
    metadata = {
        "owner": "someone",
        "status": enums.DocumentAttachmentStatus.READY.value,
    }

    if encrypted:
        metadata["is_encrypted"] = "true"

    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType="application/octet-stream",
        ContentDisposition=content_disposition_header(
            as_attachment=True, filename=name
        ),
        Metadata=metadata,
    )
    document.attachments.append(key)
    document.save()

    return key


def encrypted_document(key_id=AGRICULTURE, with_copy=True, history=()):
    """
    An encrypted document with an encrypted attachment and a user's wrapped key. Its
    content history: a plaintext version from before it was encrypted (then any
    `history` given), then two encrypted ones (the encryption, an edit).
    """
    created = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    # A fresh instance: the factory's one caches the plaintext content, which every
    # save would write back over the ciphertext.
    document = models.Document.objects.get(pk=created.pk)
    client, bucket = client_and_bucket()

    for body in (
        *history,
        base64.b64encode(CIPHERTEXT),
        base64.b64encode(CIPHERTEXT_EDITED),
    ):
        client.put_object(Bucket=bucket, Key=document.file_key, Body=body)

    document.is_encrypted = True
    document.maintenance_wrapped_document_key = (
        maintenance_copy(key_id) if with_copy else None
    )
    document.save()
    factories.UserDocumentAccessFactory(
        document=document, encrypted_document_symmetric_key_for_user="d3JhcHBlZA=="
    )
    key = put_attachment(document, b"ciphertext of the picture")

    return document, key


def yjs_with_images(*keys):
    """A raw Yjs update, BlockNote-shaped, with a paragraph and an image per key."""
    doc = pycrdt.Doc()
    doc["document-store"] = pycrdt.XmlFragment(
        [
            pycrdt.XmlElement(
                "blockGroup",
                {},
                [
                    pycrdt.XmlElement(
                        "blockContainer",
                        {"id": "1"},
                        [pycrdt.XmlElement("paragraph", {}, [pycrdt.XmlText("Hi")])],
                    ),
                    *(
                        pycrdt.XmlElement(
                            "blockContainer",
                            {"id": key},
                            [
                                pycrdt.XmlElement(
                                    "image", {"url": f"{MEDIA_URL}{key}", "name": "x"}
                                )
                            ],
                        )
                        for key in keys
                    ),
                ],
            )
        ]
    )

    return doc.get_update()


def image_urls(stored):
    """The `url` of every image in a stored (base64) content."""
    doc = pycrdt.Doc()
    doc.apply_update(base64.b64decode(stored))
    fragment = doc.get("document-store", type=pycrdt.XmlFragment)

    def walk(node):
        for child in node.children:
            if isinstance(child, pycrdt.XmlElement):
                if child.tag == "image":
                    yield child.attributes.get("url")
                yield from walk(child)

    return list(walk(fragment))


def read_manifest(folder):
    """The lines of a manifest, by id."""
    return {
        line["id"]: line
        for line in map(
            json.loads, (folder / "manifest.ndjson").read_text().splitlines()
        )
    }


def write_manifest(folder, lines):
    """A manifest of these lines."""
    (folder / "manifest.ndjson").write_text(
        "".join(json.dumps(line) + "\n" for line in lines)
    )


def object_body(key):
    """The current bytes of an object."""
    client, bucket = client_and_bucket()

    return client.get_object(Bucket=bucket, Key=key)["Body"].read()


def object_versions(key):
    """The versions of exactly this key the bucket holds."""
    client, bucket = client_and_bucket()
    versions = client.list_object_versions(Bucket=bucket, Prefix=key).get(
        "Versions", []
    )

    return [version for version in versions if version["Key"] == key]


def object_version_body(key, version_id):
    """The bytes of one version of an object."""
    client, bucket = client_and_bucket()

    return client.get_object(Bucket=bucket, Key=key, VersionId=version_id)[
        "Body"
    ].read()


def content_history(document):
    """The bytes of every version of a document's content, newest first."""
    return [
        object_version_body(document.file_key, version["VersionId"])
        for version in object_versions(document.file_key)
    ]


def attachment_objects(document):
    """Every key under the document's attachment prefix, deleted ones aside."""
    client, bucket = client_and_bucket()

    return {
        item["Key"]
        for item in client.list_objects_v2(
            Bucket=bucket, Prefix=f"{document.key_base}/attachments/"
        ).get("Contents", [])
    }


def run(command, *args, **options):
    """Run a command, returning what it printed."""
    out = StringIO()
    call_command(command, *args, stdout=out, **options)

    return out.getvalue()


# ----- Export --------------------------------------------------------------------


def test_maintenance_export_writes_the_manifest_and_copies_the_attachments(tmp_path):
    """Each escrowed document: its line, its encrypted attachments copied by key."""
    document, key = encrypted_document()
    foreign = factories.DocumentFactory()
    # Referenced from another document, and a plaintext one: neither is exported.
    document.attachments.append(f"{foreign.key_base}/attachments/{uuid.uuid4()}.png")
    plain = put_attachment(document, b"not encrypted", encrypted=False)

    output = run("maintenance_export", output=str(tmp_path / "export"))

    lines = read_manifest(tmp_path / "export")
    assert lines == {
        str(document.pk): {
            "id": str(document.pk),
            "type": "document",
            "title": document.title,
            "updatedAt": models.Document.objects.get(
                pk=document.pk
            ).updated_at.isoformat(),
            "maintenanceKey": document.maintenance_wrapped_document_key,
            "file": document.file_key,
        },
        key: {"id": key, "type": "attachment", "parent": str(document.pk), "file": key},
    }
    # The raw ciphertext the tool decrypts, not the base64 text Docs stores.
    assert (tmp_path / "export" / document.file_key).read_bytes() == CIPHERTEXT_EDITED
    assert (tmp_path / "export" / key).read_bytes() == b"ciphertext of the picture"
    assert not (tmp_path / "export" / plain).exists()
    assert "Exported 1 documents and 1 attachments" in output


def test_maintenance_export_keeps_only_the_documents_of_one_key(tmp_path):
    """--fingerprint matches bytes 2 to 17 of the copy: one organization's documents."""
    ours, _ = encrypted_document(AGRICULTURE)
    encrypted_document(INTERIEUR)

    run(
        "maintenance_export",
        output=str(tmp_path / "export"),
        # As the tool shows it, in groups of digits.
        fingerprint=" ".join(
            fingerprint_of(AGRICULTURE)[i : i + 5] for i in range(0, 40, 5)
        ),
    )

    assert {
        line["id"]
        for line in read_manifest(tmp_path / "export").values()
        if line["type"] == "document"
    } == {str(ours.pk)}


def test_maintenance_export_includes_trashed_documents(tmp_path):
    """A trashed document can still be restored, encrypted: it is recovered too."""
    document, _ = encrypted_document()
    document.soft_delete()

    run("maintenance_export", output=str(tmp_path / "export"))

    assert str(document.pk) in read_manifest(tmp_path / "export")


def test_maintenance_export_reports_the_documents_without_a_copy(tmp_path):
    """Encrypted before the escrow covered them: counted, a few named, not exported."""
    without = sorted(
        (encrypted_document(with_copy=False)[0] for _ in range(7)),
        key=lambda document: document.path,
    )
    factories.DocumentFactory()

    output = run("maintenance_export", output=str(tmp_path / "export"))

    assert read_manifest(tmp_path / "export") == {}
    warnings = [line for line in output.splitlines() if "no maintenance copy" in line]
    assert warnings == [
        "7 encrypted documents have no maintenance copy and cannot be recovered "
        "this way: " + ", ".join(str(d.pk) for d in without[:5]) + " and 2 more."
    ]

    output = run(
        "maintenance_export",
        output=str(tmp_path / "by-key"),
        fingerprint=fingerprint_of(AGRICULTURE),
    )

    assert "cannot be recovered this way, whatever their organization: " in output


def test_maintenance_export_leaves_out_a_document_whose_attachment_is_gone(tmp_path):
    """One object missing costs its document, never the rest of the export."""
    broken, key = encrypted_document()
    complete, _ = encrypted_document()
    client, bucket = client_and_bucket()
    client.delete_object(Bucket=bucket, Key=key)

    output = run("maintenance_export", output=str(tmp_path / "export"))

    lines = read_manifest(tmp_path / "export")
    assert {line["id"] for line in lines.values() if line["type"] == "document"} == {
        str(complete.pk)
    }
    assert not (tmp_path / "export" / broken.key_base).exists()
    assert f"Left out {broken.pk}: {key} is not in the bucket" in output
    assert "Exported 1 documents and 1 attachments" in output


def test_maintenance_export_refuses_a_bad_key_id_or_a_folder_in_use(tmp_path):
    """Nothing written over an earlier export or a file, nothing matched on a mistyped id."""
    (tmp_path / "used").mkdir()
    (tmp_path / "used" / "manifest.ndjson").write_text("")
    (tmp_path / "a-file").write_text("")

    with pytest.raises(CommandError, match="not empty"):
        run("maintenance_export", output=str(tmp_path / "used"))

    with pytest.raises(CommandError, match="not a folder"):
        run("maintenance_export", output=str(tmp_path / "a-file"))

    with pytest.raises(CommandError, match="40 digits"):
        run("maintenance_export", output=str(tmp_path / "export"), fingerprint="1 0418")

    # The key id in hexadecimal is not a fingerprint.
    with pytest.raises(CommandError, match="40 digits"):
        run(
            "maintenance_export",
            output=str(tmp_path / "export"),
            fingerprint=AGRICULTURE,
        )


def test_maintenance_export_keys_only_writes_only_the_copies(tmp_path):
    """--keys-only: a line per escrowed document with its copy, nothing else."""
    agriculture, _ = encrypted_document(AGRICULTURE)
    interieur, _ = encrypted_document(INTERIEUR)
    encrypted_document(with_copy=False)

    output = run("maintenance_export", output=str(tmp_path / "export"), keys_only=True)

    assert read_manifest(tmp_path / "export") == {
        str(document.pk): {
            "id": str(document.pk),
            "type": "document",
            "maintenanceKey": document.maintenance_wrapped_document_key,
        }
        for document in (agriculture, interieur)
    }
    assert [path.name for path in (tmp_path / "export").iterdir()] == [
        "manifest.ndjson"
    ]
    assert "Exported the maintenance copies of 2 documents" in output


def test_maintenance_export_keys_only_of_one_key(tmp_path):
    """With --fingerprint, the normal use: only the copies made for the key being replaced."""
    agriculture, _ = encrypted_document(AGRICULTURE)
    encrypted_document(INTERIEUR)

    run(
        "maintenance_export",
        output=str(tmp_path / "export"),
        keys_only=True,
        fingerprint=fingerprint_of(AGRICULTURE),
    )

    assert read_manifest(tmp_path / "export") == {
        str(agriculture.pk): {
            "id": str(agriculture.pk),
            "type": "document",
            "maintenanceKey": agriculture.maintenance_wrapped_document_key,
        }
    }


# ----- Import --------------------------------------------------------------------


def decrypted_export(tmp_path, document, key, content=None, **document_line):
    """What the maintenance tool hands back for a document: same lines, in plaintext."""
    folder = tmp_path / "decrypted"
    (folder / key).parent.mkdir(parents=True, exist_ok=True)
    (folder / key).write_bytes(PLAIN_IMAGE)
    # The raw Yjs update, which shows the attachment by its key.
    (folder / document.file_key).write_bytes(
        yjs_with_images(key) if content is None else content
    )
    # Another organization's items, set aside by the tool: never read by the import.
    (folder / "other-keys" / "1234").mkdir(parents=True, exist_ok=True)
    write_manifest(
        folder,
        [
            {
                "id": str(document.pk),
                "type": "document",
                "title": document.title,
                "updatedAt": models.Document.objects.get(
                    pk=document.pk
                ).updated_at.isoformat(),
                "file": document.file_key,
                **document_line,
            },
            {"id": key, "type": "attachment", "parent": str(document.pk), "file": key},
        ],
    )

    return folder


def assert_still_encrypted_but(document, key, *orphans):
    """Encrypted and intact, with plaintext objects under keys it does not list."""
    document.refresh_from_db()
    assert document.is_encrypted is True
    assert document.attachments == [key]
    assert object_body(document.file_key) == base64.b64encode(CIPHERTEXT_EDITED)
    assert attachment_objects(document) == {key, *orphans}

    for orphan in orphans:
        assert object_body(orphan) == PLAIN_IMAGE


def assert_still_encrypted(document, key):
    """The document as it was before the import, ciphertext and keys included."""
    document.refresh_from_db()
    assert document.is_encrypted is True
    assert document.maintenance_wrapped_document_key is not None
    assert document.attachments == [key]
    assert object_body(key) == b"ciphertext of the picture"
    assert object_body(document.file_key) == base64.b64encode(CIPHERTEXT_EDITED)
    assert len(object_versions(document.file_key)) == 3
    # No plaintext left behind under a new key.
    assert attachment_objects(document) == {key}
    assert models.DocumentAccess.objects.get(
        document=document
    ).encrypted_document_symmetric_key_for_user


@mock.patch("core.management.commands.maintenance_import.malware_detection")
def test_maintenance_import_switches_a_document_and_its_attachments_to_plaintext(
    malware_detection, tmp_path
):
    """
    The attachment uploaded under a new key as any upload, the content rewritten to
    show it, the keys dropped; the ciphertext left in the bucket for the purge.
    """
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)

    output = run("maintenance_import", str(folder))

    document.refresh_from_db()
    assert "Switched 1 documents to plaintext." in output
    assert document.is_encrypted is False
    assert document.maintenance_wrapped_document_key is None
    assert (
        models.DocumentAccess.objects.get(
            document=document
        ).encrypted_document_symmetric_key_for_user
        is None
    )

    [new_key] = document.attachments
    assert new_key != key
    assert new_key.startswith(f"{document.key_base}/attachments/")
    assert new_key.endswith(".png")
    assert object_body(new_key) == PLAIN_IMAGE
    assert image_urls(object_body(document.file_key)) == [f"{MEDIA_URL}{new_key}"]

    client, bucket = client_and_bucket()
    head = client.head_object(Bucket=bucket, Key=new_key)
    assert head["ContentType"] == "image/png"
    assert head["ContentDisposition"] == 'inline; filename="facture.png"'
    assert head["Metadata"] == {
        "owner": "someone",
        "status": enums.DocumentAttachmentStatus.PROCESSING.value,
    }
    malware_detection.analyse_file.assert_called_once_with(
        new_key, document_id=document.pk
    )
    assert not models.MaintenanceImportUpload.objects.exists()

    # The ciphertext untouched, out of reach, for an investigation until the purge.
    assert object_body(key) == b"ciphertext of the picture"
    assert len(object_versions(document.file_key)) == 4


@mock.patch("core.management.commands.maintenance_import.malware_detection")
def test_maintenance_import_uploads_an_unsafe_attachment_as_unsafe(
    _malware_detection, tmp_path
):
    """Not what its name says: flagged, and downloaded rather than shown."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    (folder / key).write_bytes(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n")

    run("maintenance_import", str(folder))

    document.refresh_from_db()
    [new_key] = document.attachments
    assert new_key.endswith("-unsafe.png")
    client, bucket = client_and_bucket()
    head = client.head_object(Bucket=bucket, Key=new_key)
    assert head["ContentType"] == "application/pdf"
    assert head["ContentDisposition"] == 'attachment; filename="facture.png"'
    assert head["Metadata"]["is_unsafe"] == "true"


def test_maintenance_import_leaves_a_document_edited_since_the_export(tmp_path):
    """The `updatedAt` compare-and-swap: export it again, in the next batch."""
    document, key = encrypted_document()
    folder = decrypted_export(
        tmp_path, document, key, updatedAt="2020-01-01T00:00:00+00:00"
    )

    output = run("maintenance_import", str(folder))

    assert f"Skipped {document.pk}: edited since the export" in output
    assert_still_encrypted(document, key)


def test_maintenance_import_leaves_a_document_edited_during_its_uploads(tmp_path):
    """Checked again under the lock: the uploads made meanwhile are deleted."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    real_put = client_and_bucket()[0].put_object

    def put_then_edit(**kwargs):
        response = real_put(**kwargs)
        # Someone saves the document while the attachment uploads.
        models.Document.objects.get(pk=document.pk).save()

        return response

    with mock.patch.object(
        client_and_bucket()[0], "put_object", side_effect=put_then_edit
    ):
        output = run("maintenance_import", str(folder))

    assert f"Skipped {document.pk}: edited since the export" in output
    document.refresh_from_db()
    assert document.is_encrypted is True
    assert attachment_objects(document) == {key}
    assert object_body(document.file_key) == base64.b64encode(CIPHERTEXT_EDITED)


def test_maintenance_import_leaves_a_document_with_an_item_not_decrypted(tmp_path):
    """Whole or not at all: its key stays, or the failed item could never be opened."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    lines = list(read_manifest(folder).values())
    lines[1] = {**lines[1], "error": "WRONG_SECRET_KEY: damaged"}
    del lines[1]["file"]
    write_manifest(folder, lines)

    output = run("maintenance_import", str(folder))

    assert (
        f"Skipped {document.pk}: 1 of its items were not decrypted (WRONG_SECRET_KEY: damaged)"
        in output
    )
    assert_still_encrypted(document, key)


def test_maintenance_import_refuses_a_manifest_still_encrypted(tmp_path):
    """The encrypted export given instead of the decrypted copy: refused before anything."""
    document, key = encrypted_document()
    folder = decrypted_export(
        tmp_path,
        document,
        key,
        maintenanceKey=document.maintenance_wrapped_document_key,
    )

    with pytest.raises(CommandError, match="still carry a key"):
        run("maintenance_import", str(folder))

    assert_still_encrypted(document, key)

    lines = list(read_manifest(folder).values())
    del lines[0]["maintenanceKey"]
    lines[1]["wrappedKey"] = "AY3x"
    write_manifest(folder, lines)

    with pytest.raises(CommandError, match="still carry a key"):
        run("maintenance_import", str(folder))

    assert_still_encrypted(document, key)


def test_maintenance_import_leaves_a_document_whose_content_is_not_yjs(tmp_path):
    """What the frontend could not open never replaces the ciphertext."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key, content=os.urandom(64))

    output = run("maintenance_import", str(folder))

    assert (
        f"Skipped {document.pk}: its decrypted content is not a Yjs document" in output
    )
    assert_still_encrypted(document, key)


def test_maintenance_import_leaves_a_document_naming_an_object_not_its_own(tmp_path):
    """
    The manifest names the objects the import reads and replaces: another document's
    attachment, or one of its own that is not encrypted, is never touched.
    """
    document, key = encrypted_document()
    other, other_key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    (folder / other_key).parent.mkdir(parents=True, exist_ok=True)
    (folder / other_key).write_bytes(PLAIN_IMAGE)
    lines = list(read_manifest(folder).values())
    write_manifest(
        folder,
        [
            *lines,
            {
                "id": other_key,
                "type": "attachment",
                "parent": str(document.pk),
                "file": other_key,
            },
        ],
    )

    output = run("maintenance_import", str(folder))

    assert (
        f"Skipped {document.pk}: {other_key} is not one of its encrypted attachments"
        in output
    )
    assert_still_encrypted(document, key)
    assert_still_encrypted(other, other_key)

    plain = put_attachment(document, PLAIN_IMAGE, encrypted=False)
    (folder / plain).write_bytes(PLAIN_IMAGE)
    lines[1:] = [
        lines[1],
        {"id": plain, "type": "attachment", "parent": str(document.pk), "file": plain},
    ]
    lines[0]["updatedAt"] = models.Document.objects.get(
        pk=document.pk
    ).updated_at.isoformat()
    write_manifest(folder, lines)

    output = run("maintenance_import", str(folder))

    assert (
        f"Skipped {document.pk}: {plain} is not one of its encrypted attachments"
        in output
    )
    document.refresh_from_db()
    assert document.is_encrypted is True


def test_maintenance_import_leaves_a_document_with_an_attachment_missing(tmp_path):
    """An encrypted attachment absent from the export would stay under a dropped key."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    late = put_attachment(document, b"ciphertext added after the export")
    lines = list(read_manifest(folder).values())
    lines[0]["updatedAt"] = models.Document.objects.get(
        pk=document.pk
    ).updated_at.isoformat()
    write_manifest(folder, lines)

    output = run("maintenance_import", str(folder))

    assert (
        f"Skipped {document.pk}: 1 of its encrypted attachments are not in the export "
        f"({late})" in output
    )
    document.refresh_from_db()
    assert document.is_encrypted is True
    assert attachment_objects(document) == {key, late}


def test_maintenance_import_undoes_the_objects_of_a_document_that_fails_half_way(
    tmp_path,
):
    """The database rolls back, and every object written is dropped: ciphertext again."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)

    with mock.patch.object(
        models.DocumentAccess.objects,
        "filter",
        side_effect=RuntimeError("database gone"),
    ):
        output = run("maintenance_import", str(folder))

    assert f"Skipped {document.pk}: failed, rolled back: database gone" in output
    assert_still_encrypted(document, key)
    assert len(object_versions(key)) == 1
    assert not models.MaintenanceImportUpload.objects.exists()


def kill_after_the_uploads(folder):
    """
    A run killed after its uploads, before the switch commits: like SIGKILL, it
    gets no chance to undo anything. Returns the keys it uploaded.
    """
    with (
        mock.patch("core.management.commands.maintenance_import.Command.undo") as undo,
        mock.patch.object(
            models.DocumentAccess.objects, "filter", side_effect=RuntimeError("killed")
        ),
    ):
        run("maintenance_import", str(folder))

    undo.assert_called_once()

    return [key for key, _ in undo.call_args.args[0]]


@mock.patch("core.management.commands.maintenance_import.malware_detection")
def test_maintenance_import_deletes_what_a_killed_run_left_then_switches(
    _malware_detection, tmp_path
):
    """
    The journal, committed before the uploads, names the plaintext objects a killed
    run left: the next run deletes them, every version, before importing again.
    """
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)

    [orphan] = kill_after_the_uploads(folder)

    assert_still_encrypted_but(document, key, orphan)
    assert list(
        models.MaintenanceImportUpload.objects.values_list("key", "document_id")
    ) == [(orphan, document.pk)]

    output = run("maintenance_import", str(folder))

    assert "Deleted 1 plaintext objects a killed run left behind." in output
    assert "Switched 1 documents to plaintext." in output
    assert object_versions(orphan) == []
    document.refresh_from_db()
    assert document.is_encrypted is False
    [new_key] = document.attachments
    assert new_key != orphan
    assert attachment_objects(document) == {key, new_key}
    assert not models.MaintenanceImportUpload.objects.exists()


def test_maintenance_purge_versions_deletes_what_a_killed_import_left(tmp_path):
    """Listed without --delete, deleted with it, the document left encrypted."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    [orphan] = kill_after_the_uploads(folder)

    output = run("maintenance_purge_versions", str(folder))

    assert "Found 1 uploads a killed import left behind." in output
    assert object_body(orphan) == PLAIN_IMAGE

    output = run("maintenance_purge_versions", str(folder), delete=True)

    assert "Deleted 1 plaintext objects a killed import left behind." in output
    assert_still_encrypted(document, key)
    assert object_versions(orphan) == []
    assert not models.MaintenanceImportUpload.objects.exists()


def test_maintenance_import_keeps_a_journaled_object_a_document_lists(tmp_path):
    """Its switch committed and only the row survived: the row goes, the object stays."""
    document, _key = encrypted_document()
    plain = put_attachment(document, PLAIN_IMAGE, encrypted=False)
    models.MaintenanceImportUpload.objects.create(key=plain, document_id=document.pk)
    folder = tmp_path / "empty"
    folder.mkdir()
    write_manifest(folder, [])

    output = run("maintenance_import", str(folder))

    assert "plaintext objects a killed run left behind" not in output
    assert object_body(plain) == PLAIN_IMAGE
    assert not models.MaintenanceImportUpload.objects.exists()


def test_maintenance_import_dry_run_changes_nothing(tmp_path):
    """Every check made, nothing written."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)

    output = run("maintenance_import", str(folder), dry_run=True)

    assert "Would switch 1 documents to plaintext." in output
    assert_still_encrypted(document, key)


@mock.patch("core.management.commands.maintenance_import.malware_detection")
def test_maintenance_import_keeps_a_commit_whose_scan_fails(
    malware_detection, tmp_path
):
    """
    What fails after the commit is reported, never undone: undoing it would delete
    the plaintext of a document whose keys are already dropped. The next run sends
    what is still unscanned.
    """
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    malware_detection.analyse_file.side_effect = RuntimeError("scanner down")

    output = run("maintenance_import", str(folder))

    document.refresh_from_db()
    [new_key] = document.attachments
    assert "Switched 1 documents to plaintext." in output
    assert (
        f"Switched {document.pk}, but {new_key} was not sent to the malware scan "
        "(scanner down)" in output
    )
    assert document.is_encrypted is False
    assert object_body(new_key) == PLAIN_IMAGE
    assert image_urls(object_body(document.file_key)) == [f"{MEDIA_URL}{new_key}"]

    malware_detection.analyse_file.side_effect = None
    malware_detection.analyse_file.reset_mock()
    output = run("maintenance_import", str(folder))

    assert (
        f"Skipped {document.pk}: already in plaintext (1 attachments sent to the scan)"
        in output
    )
    malware_detection.analyse_file.assert_called_once_with(
        new_key, document_id=document.pk
    )


@mock.patch("core.management.commands.maintenance_import.malware_detection")
def test_maintenance_import_can_run_again(malware_detection, tmp_path):
    """A second run, after an interruption say, leaves the switched documents alone."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    run("maintenance_import", str(folder))
    document.refresh_from_db()
    attachments = document.attachments

    output = run("maintenance_import", str(folder))

    # A scan not finished yet (mocked here) is asked again, harmlessly.
    assert (
        f"Skipped {document.pk}: already in plaintext (1 attachments sent to the scan)"
        in output
    )
    document.refresh_from_db()
    assert document.attachments == attachments
    assert len(object_versions(document.file_key)) == 4
    assert malware_detection.analyse_file.call_count == 2


@mock.patch("core.management.commands.maintenance_import.malware_detection")
def test_maintenance_import_says_already_in_plaintext_when_decrypted_meanwhile(
    malware_detection, tmp_path
):
    """Decrypted from the interface since the export: left alone, without a failure."""
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    # What removing the encryption from the interface does: new attachment, old one
    # dropped, keys cleared.
    client, bucket = client_and_bucket()
    client.delete_object(Bucket=bucket, Key=key)
    document.attachments = []
    document.is_encrypted = False
    document.maintenance_wrapped_document_key = None
    document.save()

    output = run("maintenance_import", str(folder))

    assert f"Skipped {document.pk}: already in plaintext" in output
    assert "failed" not in output
    malware_detection.analyse_file.assert_not_called()


@mock.patch("core.management.commands.maintenance_import.malware_detection")
def test_maintenance_import_run_again_repairs_a_run_stopped_before_its_commit(
    _malware_detection, tmp_path
):
    """
    Killed between the content write and the commit: the document still says
    encrypted over plaintext content, unreadable in Docs until the next run, which
    imports it again; the purge then finds every ciphertext version.
    """
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    client, bucket = client_and_bucket()
    client.put_object(
        Bucket=bucket,
        Key=document.file_key,
        Body=base64.b64encode(yjs_with_images(key)),
    )

    output = run("maintenance_import", str(folder))

    document.refresh_from_db()
    assert "Switched 1 documents to plaintext." in output
    assert document.is_encrypted is False

    output = run("maintenance_purge_versions", str(folder), delete=True)

    assert "Deleted 3 encrypted versions" in output
    assert len(content_history(document)) == 3
    assert all(map(is_plain_yjs, content_history(document)))
    assert object_versions(key) == []


def test_maintenance_import_refuses_a_folder_without_manifest(tmp_path):
    """The archive must be unzipped, or the folder the tool wrote given."""
    with pytest.raises(CommandError, match="No manifest.ndjson"):
        run("maintenance_import", str(tmp_path))


# ----- Purge ---------------------------------------------------------------------


@mock.patch("core.management.commands.maintenance_import.malware_detection")
def test_maintenance_purge_versions_lists_then_deletes_the_ciphertext(
    _malware_detection, tmp_path
):
    """
    Listed by default; deleted on request: the encrypted content versions and the
    old attachment object, the content's plaintext history and the new attachment kept.
    """
    document, key = encrypted_document()
    folder = decrypted_export(tmp_path, document, key)
    run("maintenance_import", str(folder))
    document.refresh_from_db()
    [new_key] = document.attachments

    output = run("maintenance_purge_versions", str(folder))

    assert "Found 0 uploads a killed import left behind." in output
    assert "Found 3 encrypted versions" in output
    assert "in 1 documents." in output
    assert len(output.splitlines()) == 5
    assert len(object_versions(document.file_key)) == 4

    output = run("maintenance_purge_versions", str(folder), delete=True)

    assert "Deleted 3 encrypted versions" in output
    history = content_history(document)
    assert len(history) == 2
    assert history[-1] == PLAIN_CONTENT.encode()
    assert image_urls(history[0]) == [f"{MEDIA_URL}{new_key}"]
    assert object_versions(key) == []
    assert object_body(new_key) == PLAIN_IMAGE
    assert "Found 0 encrypted versions" in run(
        "maintenance_purge_versions", str(folder)
    )


@mock.patch("core.management.commands.maintenance_import.malware_detection")
def test_maintenance_purge_versions_keeps_what_predates_the_encryption(
    _malware_detection, tmp_path
):
    """
    A version from before the encryption that does not read as Yjs (damaged, say)
    lies below the last plaintext one before the ciphertext: kept.
    """
    damaged = base64.b64encode(b"not a Yjs update")
    document, key = encrypted_document(history=(damaged, PLAIN_CONTENT.encode()))
    folder = decrypted_export(tmp_path, document, key)
    run("maintenance_import", str(folder))

    output = run("maintenance_purge_versions", str(folder), delete=True)

    assert "Deleted 3 encrypted versions" in output
    history = content_history(document)
    assert len(history) == 4
    assert history[2] == damaged


def test_maintenance_purge_versions_leaves_a_document_still_encrypted(tmp_path):
    """Skipped by the import: its versions are its content, never touched."""
    document, key = encrypted_document()
    folder = decrypted_export(
        tmp_path, document, key, updatedAt="2020-01-01T00:00:00+00:00"
    )
    run("maintenance_import", str(folder))

    output = run("maintenance_purge_versions", str(folder), delete=True)

    assert "Deleted 0 encrypted versions (0 bytes) in 0 documents." in output
    assert_still_encrypted(document, key)


def test_maintenance_purge_versions_refuses_a_folder_without_manifest(tmp_path):
    """The same folder as the import's."""
    with pytest.raises(CommandError, match="No manifest.ndjson"):
        run("maintenance_purge_versions", str(tmp_path))


def test_maintenance_escrow_object_versions_reads_every_page():
    """A key with more versions than a page holds: all of them, and only its own."""
    client = mock.Mock()
    client.get_paginator.return_value.paginate.return_value = [
        {"Versions": [{"Key": "a/file", "VersionId": "2"}, {"Key": "a/file2"}]},
        {"Versions": [{"Key": "a/file", "VersionId": "1"}]},
        {},
    ]

    with mock.patch(
        "core.utils.maintenance_escrow.s3", return_value=(client, "bucket")
    ):
        versions = listed_versions("a/file")

    client.get_paginator.assert_called_once_with("list_object_versions")
    assert [version["VersionId"] for version in versions] == ["2", "1"]
