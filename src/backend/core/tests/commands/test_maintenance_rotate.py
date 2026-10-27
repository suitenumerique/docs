"""
Tests for the rotation of the maintenance copies to a new maintenance key: the
maintenance tool's re-wrap of `maintenance_export --keys-only`, written back by
`maintenance_rotate`. Only the database is involved.
"""

import base64
import json
import os
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db.models.query import QuerySet

import pytest

from core import factories, models

pytestmark = pytest.mark.django_db

AGRICULTURE = "0123456789abcdef0123456789abcdef"
INTERIEUR = "fedcba9876543210fedcba9876543210"


def maintenance_copy(key_id):
    """A maintenance copy as the vault writes it: version, key id, then the wrap."""
    return base64.b64encode(
        bytes([1]) + bytes.fromhex(key_id) + os.urandom(48)
    ).decode()


def write_manifest(folder, lines):
    """A manifest of these lines."""
    (folder / "manifest.ndjson").write_text(
        "".join(json.dumps(line) + "\n" for line in lines)
    )


def run(command, *args, **options):
    """Run a command, returning what it printed."""
    out = StringIO()
    call_command(command, *args, stdout=out, **options)

    return out.getvalue()


def escrowed_document(key_id=AGRICULTURE):
    """An encrypted document and its maintenance copy: all the rotation looks at."""
    return factories.DocumentFactory(
        is_encrypted=True, maintenance_wrapped_document_key=maintenance_copy(key_id)
    )


def rotated_line(document, **line):
    """What the maintenance tool hands back for a document it re-wrapped."""
    return {
        "id": str(document.pk),
        "type": "document",
        "maintenanceKey": maintenance_copy(INTERIEUR),
        "previousMaintenanceKey": document.maintenance_wrapped_document_key,
        **line,
    }


def stored_copy(document):
    """The maintenance copy the database holds for a document now."""
    return models.Document.objects.get(pk=document.pk).maintenance_wrapped_document_key


def test_maintenance_rotate_replaces_the_copies(tmp_path):
    """Each copy replaced by its re-wrap, without counting as an edit."""
    documents = [escrowed_document(), escrowed_document()]
    updated_at = [document.updated_at for document in documents]
    lines = [rotated_line(document) for document in documents]
    write_manifest(tmp_path, lines)

    output = run("maintenance_rotate", str(tmp_path))

    assert [stored_copy(document) for document in documents] == [
        line["maintenanceKey"] for line in lines
    ]
    assert [
        models.Document.objects.get(pk=document.pk).updated_at for document in documents
    ] == updated_at
    assert output == "Rotated the maintenance copies of 2 documents.\n"


def test_maintenance_rotate_skips_a_copy_changed_since_the_export(tmp_path):
    """
    Encryption removed then encrypted again under a new document key: the copy
    exported no longer opens it, its re-wrap would not either.
    """
    changed = escrowed_document()
    line = rotated_line(changed)
    changed.maintenance_wrapped_document_key = maintenance_copy(AGRICULTURE)
    changed.save()
    gone = escrowed_document()
    gone_line = rotated_line(gone)
    gone.delete()
    write_manifest(tmp_path, [line, gone_line])

    output = run("maintenance_rotate", str(tmp_path))

    assert stored_copy(changed) == changed.maintenance_wrapped_document_key
    assert output.splitlines() == [
        "Rotated the maintenance copies of 0 documents.",
        f"Skipped {changed.pk}: its copy changed since the export",
        f"Skipped {gone.pk}: no longer exists",
    ]


def test_maintenance_rotate_skips_what_the_tool_could_not_rewrap(tmp_path):
    """A line the tool failed, or a new copy that is not one, leaves its copy as it is."""
    failed = escrowed_document()
    malformed = escrowed_document()
    rotated = escrowed_document()
    failed_line = rotated_line(
        failed, error="NOT_FOR_THIS_KEY: wrapped for another key"
    )
    del failed_line["maintenanceKey"]
    write_manifest(
        tmp_path,
        [
            failed_line,
            rotated_line(malformed, maintenanceKey="d3JhcHBlZA=="),
            rotated_line(rotated),
        ],
    )
    previous = {document.pk: stored_copy(document) for document in (failed, malformed)}

    output = run("maintenance_rotate", str(tmp_path))

    assert {document.pk: stored_copy(document) for document in (failed, malformed)} == (
        previous
    )
    assert stored_copy(rotated) != rotated.maintenance_wrapped_document_key
    assert output.splitlines() == [
        "Rotated the maintenance copies of 1 documents.",
        f"Skipped {failed.pk}: the maintenance tool could not re-wrap its copy "
        "(NOT_FOR_THIS_KEY: wrapped for another key)",
        f"Skipped {malformed.pk}: the new copy is not a maintenance copy",
    ]


def test_maintenance_rotate_dry_run_changes_nothing(tmp_path):
    """--dry-run says what would happen and writes nothing."""
    document = escrowed_document()
    changed = escrowed_document()
    line = rotated_line(changed)
    changed.maintenance_wrapped_document_key = maintenance_copy(AGRICULTURE)
    changed.save()
    write_manifest(tmp_path, [rotated_line(document), line])

    output = run("maintenance_rotate", str(tmp_path), dry_run=True)

    assert stored_copy(document) == document.maintenance_wrapped_document_key
    assert output.splitlines() == [
        "Would rotate the maintenance copies of 1 documents.",
        f"Skipped {changed.pk}: its copy changed since the export",
    ]


def test_maintenance_rotate_refuses_a_folder_without_manifest(tmp_path):
    """The archive must be unzipped, or the folder the tool wrote given."""
    with pytest.raises(CommandError, match="No manifest.ndjson"):
        run("maintenance_rotate", str(tmp_path))


def test_maintenance_rotate_refuses_a_line_that_is_not_json(tmp_path):
    """The whole manifest is read before any write, and the broken line is named."""
    (tmp_path / "manifest.ndjson").write_text('{"id": "a"}\n\n{not json\n')

    with pytest.raises(CommandError, match="Line 3 of manifest.ndjson is not JSON"):
        run("maintenance_rotate", str(tmp_path))


def test_maintenance_rotate_refuses_the_export_itself(tmp_path):
    """The keys-only export, given before the tool re-wrapped it: nothing written."""
    document = escrowed_document()
    run("maintenance_export", output=str(tmp_path / "export"), keys_only=True)

    with pytest.raises(CommandError, match="carry no previousMaintenanceKey"):
        run("maintenance_rotate", str(tmp_path / "export"))

    assert stored_copy(document) == document.maintenance_wrapped_document_key


def test_maintenance_rotate_is_all_or_nothing(tmp_path):
    """A failure on the second document leaves the first one's copy unrotated too."""
    documents = [escrowed_document(), escrowed_document()]
    write_manifest(tmp_path, [rotated_line(document) for document in documents])
    real_update = QuerySet.update
    calls = []

    def update_failing_the_second(queryset, **kwargs):
        calls.append(kwargs)

        if len(calls) == 2:
            raise RuntimeError("the database went away")

        return real_update(queryset, **kwargs)

    with (
        mock.patch.object(QuerySet, "update", update_failing_the_second),
        pytest.raises(RuntimeError, match="went away"),
    ):
        run("maintenance_rotate", str(tmp_path))

    assert len(calls) == 2
    assert [stored_copy(document) for document in documents] == [
        document.maintenance_wrapped_document_key for document in documents
    ]
