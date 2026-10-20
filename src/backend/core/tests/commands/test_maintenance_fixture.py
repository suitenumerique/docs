"""
A batch recovery on fixed data: the fixture (`core/tests/data/maintenance_escrow/`)
made once with the encryption service's code, seeded as the frontend stores an
encrypted document, exported, decrypted as the maintenance tool would, imported, and
read back through the API. What the maintenance tool expects of the export and hands
back is pinned here, so a drift on Docs' side fails without the tool or a browser;
the opt-in browser test runs the real tool on the same fixture.
"""

import base64
import json
import shutil
from io import StringIO

from django.core.files.storage import default_storage
from django.core.management import call_command

import pycrdt
import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.tests.utils.maintenance_fixture import (
    load_fixture,
    plaintext_bytes,
    seed_maintenance_fixture,
    stored_bytes,
)
from core.utils.maintenance_escrow import (
    MANIFEST_FILE,
    key_id_from_fingerprint,
    maintenance_key_id,
)
from core.utils.yjs import base64_yjs_to_text

pytestmark = pytest.mark.django_db

FIXTURE = load_fixture()
OURS, THEIRS = FIXTURE["documents"]


def run(command, *args, **options):
    """Run a command, returning what it printed."""
    out = StringIO()
    call_command(command, *args, stdout=out, **options)

    return out.getvalue()


def manifest(folder):
    """The lines of a manifest, in order."""
    return [
        json.loads(line)
        for line in (folder / MANIFEST_FILE).read_text(encoding="utf-8").splitlines()
    ]


def files_in(folder):
    """Every file of a folder, by its path inside it."""
    return {
        str(path.relative_to(folder)) for path in folder.rglob("*") if path.is_file()
    }


def decrypt_as_the_tool(export, output):
    """
    What the maintenance tool writes from an export opened with the development
    phrase, its plaintext taken from the fixture: the same lines, each without
    `maintenanceKey` and `wrappedKey`, each `file` path holding the plaintext (Docs
    puts no `content` inline, which would come back in plaintext base64); a document
    escrowed for another key, with its items, set aside unchanged under
    `other-keys/<fingerprint>/`.
    """
    ours = key_id_from_fingerprint(FIXTURE["fingerprint"])
    output.mkdir(parents=True)
    lines = manifest(export)
    foreign = {
        line["id"]
        for line in lines
        if "maintenanceKey" in line
        and maintenance_key_id(line["maintenanceKey"]) != ours
    }
    decrypted = []
    set_aside = []

    for line in lines:
        if line["id"] in foreign or line.get("parent") in foreign:
            set_aside.append(line)
            continue

        plain = {
            field: value
            for field, value in line.items()
            if field not in ("maintenanceKey", "wrappedKey")
        }

        if "file" in plain:
            (output / plain["file"]).parent.mkdir(parents=True, exist_ok=True)
            (output / plain["file"]).write_bytes(plaintext_bytes(plain["file"]))

        decrypted.append(plain)

    if set_aside:
        other = output / "other-keys" / THEIRS["fingerprint"]
        other.mkdir(parents=True)
        (other / MANIFEST_FILE).write_text(
            "".join(json.dumps(line) + "\n" for line in set_aside)
        )

        for line in set_aside:
            if "file" in line:
                (other / line["file"]).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(export / line["file"], other / line["file"])

    (output / MANIFEST_FILE).write_text(
        "".join(json.dumps(line) + "\n" for line in decrypted)
    )

    return output


def image_urls(stored):
    """The `url` of every image of a content as the API serves it (base64 Yjs)."""
    doc = pycrdt.Doc()
    doc.apply_update(base64.b64decode(stored))

    def walk(node):
        for child in node.children:
            if isinstance(child, pycrdt.XmlElement):
                if child.tag == "image":
                    yield child.attributes.get("url")
                yield from walk(child)

    return list(walk(doc.get("document-store", type=pycrdt.XmlFragment)))


def test_maintenance_fixture_is_what_the_frontend_stores():
    """The fixture itself: ciphertext in the bucket, a Yjs content naming its attachments."""
    content = plaintext_bytes(OURS["file"])
    keys = [attachment["key"] for attachment in OURS["attachments"]]

    # Base64 of the ciphertext, which is not Yjs; its plaintext is.
    pycrdt.Doc().apply_update(content)
    assert base64.b64decode(stored_bytes(OURS["file"])) != content
    assert stored_bytes(keys[0]) != plaintext_bytes(keys[0])
    assert plaintext_bytes(keys[0]).startswith(b"\x89PNG")
    assert maintenance_key_id(OURS["maintenanceKey"]) == key_id_from_fingerprint(
        FIXTURE["fingerprint"]
    )
    assert maintenance_key_id(THEIRS["maintenanceKey"]) != key_id_from_fingerprint(
        FIXTURE["fingerprint"]
    )

    # Both forms the editor writes: the media URL, and the media-check one.
    first, second = image_urls(base64.b64encode(content))
    assert first.endswith(f"/media/{keys[0]}")
    assert second.endswith(f"/media-check/?key={keys[1].replace('/', '%2F')}")


def test_maintenance_fixture_export_is_what_the_tool_reads(tmp_path):
    """One organization's documents, their raw ciphertext under their object keys."""
    seed_maintenance_fixture(factories.UserFactory())
    export = tmp_path / "export"

    output = run(
        "maintenance_export", output=str(export), fingerprint=FIXTURE["fingerprint"]
    )

    document = models.Document.objects.get(pk=OURS["id"])
    keys = [attachment["key"] for attachment in OURS["attachments"]]
    assert manifest(export) == [
        {
            "id": OURS["id"],
            "type": "document",
            "maintenanceKey": OURS["maintenanceKey"],
            "title": OURS["title"],
            "updatedAt": document.updated_at.isoformat(),
            "file": OURS["file"],
        },
        *(
            {"id": key, "type": "attachment", "parent": OURS["id"], "file": key}
            for key in keys
        ),
    ]
    assert files_in(export) == {MANIFEST_FILE, OURS["file"], *keys}
    # The tool reads the raw ciphertext, not the base64 text Docs stores.
    assert (export / OURS["file"]).read_bytes() == base64.b64decode(
        stored_bytes(OURS["file"])
    )

    for key in keys:
        assert (export / key).read_bytes() == stored_bytes(key)

    assert "Exported 1 documents and 2 attachments" in output
    assert "no maintenance copy" not in output

    # Without --fingerprint, the other organization's document comes too.
    run("maintenance_export", output=str(tmp_path / "all"))

    assert [
        line["id"] for line in manifest(tmp_path / "all") if line["type"] == "document"
    ] == [OURS["id"], THEIRS["id"]]


def test_maintenance_fixture_round_trip_through_the_api(tmp_path):
    """
    Seeded, exported, decrypted, imported: the document reads in plaintext through
    the API, its attachments under new keys its content names, served to its owner.
    """
    owner = factories.UserFactory()
    seed_maintenance_fixture(owner)
    export = tmp_path / "export"
    run("maintenance_export", output=str(export), fingerprint=FIXTURE["fingerprint"])
    decrypted = decrypt_as_the_tool(export, tmp_path / "decrypted")

    output = run("maintenance_import", str(decrypted))

    assert "Switched 1 documents to plaintext." in output
    assert "Skipped" not in output

    client = APIClient()
    client.force_login(owner)
    response = client.get(f"/api/v1.0/documents/{OURS['id']}/")

    assert response.status_code == 200
    assert response.json()["is_encrypted"] is False

    old_keys = [attachment["key"] for attachment in OURS["attachments"]]
    document = models.Document.objects.get(pk=OURS["id"])
    new_keys = document.attachments
    assert len(new_keys) == 2
    assert not set(new_keys) & set(old_keys)
    assert document.maintenance_wrapped_document_key is None
    # The other organization's document is untouched, still encrypted.
    assert models.Document.objects.get(pk=THEIRS["id"]).is_encrypted is True

    client_s3, bucket = (
        default_storage.connection.meta.client,
        default_storage.bucket_name,
    )

    for old_key, new_key in zip(old_keys, new_keys, strict=True):
        assert client_s3.get_object(Bucket=bucket, Key=new_key)[
            "Body"
        ].read() == plaintext_bytes(old_key)
        # The development scanner marks it ready: the media authorization serves it.
        response = client.get(
            "/api/v1.0/documents/media-auth/",
            HTTP_X_ORIGINAL_URL=f"http://localhost/media/{new_key}",
        )
        assert response.status_code == 200

    # Last: the database connection does not outlive a streamed response here.
    response = client.get(f"/api/v1.0/documents/{OURS['id']}/content/")

    assert response.status_code == 200
    content = b"".join(response.streaming_content).decode()
    text = base64_yjs_to_text(content)

    for expected in OURS["texts"]:
        assert expected in text

    # Each reference rewritten in its own form.
    first, second = image_urls(content)
    assert first.endswith(f"/media/{new_keys[0]}")
    assert second.endswith(f"/media-check/?key={new_keys[1].replace('/', '%2F')}")
