"""Unit tests for the `migrate_documents` command."""

import uuid
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError

import pytest

from core import factories, models
from core.services.yhub_services import APIError, ServiceUnavailableError, YHubService

pytestmark = pytest.mark.django_db


def migrated(status="ok", **stats):
    """What the collaboration server answers for a document it migrated."""
    return {"status": status, "migrated": status == "ok", **stats}


@pytest.fixture(name="collaboration_server", autouse=True)
def collaboration_server_fixture():
    """Answer every document as migrated, unless a test says otherwise."""
    with mock.patch.object(
        YHubService, "migrate", return_value=migrated()
    ) as mock_migrate:
        yield mock_migrate


def run_command(**options):
    """Run the command and return what it wrote."""
    stdout = StringIO()
    call_command("migrate_documents", stdout=stdout, **options)

    return stdout.getvalue()


def test_commands_migrate_documents(collaboration_server):
    """Every document should be handed to the collaboration server, once."""
    documents = factories.DocumentFactory.create_batch(3)
    collaboration_server.return_value = migrated(
        versions=4, applied=3, skipped=1, dropped=2, durationMs=42
    )

    output = run_command()

    assert collaboration_server.call_count == 3
    handed = {call.args[0].pk for call in collaboration_server.call_args_list}
    assert handed == {document.pk for document in documents}

    assert models.DocumentMigration.objects.count() == 3
    migration = models.DocumentMigration.objects.first()
    assert migration.status == models.DocumentMigrationStatus.MIGRATED
    assert (migration.versions, migration.applied) == (4, 3)
    assert (migration.skipped, migration.dropped) == (1, 2)
    assert migration.duration_ms == 42
    assert "ok=3" in output


@pytest.mark.parametrize("status", ["ok", "already", "empty", "nothing"])
def test_commands_migrate_documents_records_every_outcome(collaboration_server, status):
    """The four answers of the collaboration server are all terminal."""
    document = factories.DocumentFactory()
    collaboration_server.return_value = migrated(status)

    run_command()

    assert models.DocumentMigration.objects.get(document=document).status == status

    # none of them is handed over again
    run_command()

    assert collaboration_server.call_count == 1


def test_commands_migrate_documents_failure_is_recorded_and_retried(
    collaboration_server,
):
    """A document that could not be migrated should be left for another run."""
    document = factories.DocumentFactory()
    collaboration_server.side_effect = APIError("yhub is confused", status_code=400)

    output = run_command(retries=1)

    migration = models.DocumentMigration.objects.get(document=document)
    assert migration.status == models.DocumentMigrationStatus.FAILED
    assert "yhub is confused" in migration.error
    assert "failed=1" in output

    # left alone by a plain run, handed over again when asked for
    run_command()
    assert collaboration_server.call_count == 1

    collaboration_server.side_effect = None
    collaboration_server.return_value = migrated()
    run_command(retry_failed=True)

    assert collaboration_server.call_count == 2
    assert (
        models.DocumentMigration.objects.get(document=document).status
        == models.DocumentMigrationStatus.MIGRATED
    )


def test_commands_migrate_documents_retries_a_server_that_is_unwell(
    collaboration_server,
):
    """A 5xx is about the server, the same document is worth handing over again."""
    document = factories.DocumentFactory()
    collaboration_server.side_effect = [
        ServiceUnavailableError("connection reset"),
        migrated(),
    ]

    with mock.patch("time.sleep"):  # no backoff wait in tests
        run_command(retries=2)

    assert collaboration_server.call_count == 2
    assert (
        models.DocumentMigration.objects.get(document=document).status
        == models.DocumentMigrationStatus.MIGRATED
    )


def test_commands_migrate_documents_does_not_retry_a_refused_document(
    collaboration_server,
):
    """A 4xx is about the document, insisting would only waste the server."""
    factories.DocumentFactory()
    collaboration_server.side_effect = APIError("Room name is invalid", status_code=400)

    with mock.patch("time.sleep"):
        run_command(retries=3)

    assert collaboration_server.call_count == 1


def test_commands_migrate_documents_limit(collaboration_server):
    """The most recently edited documents should be migrated first."""
    factories.DocumentFactory.create_batch(3)
    recent = factories.DocumentFactory()

    run_command(limit=1)

    assert collaboration_server.call_count == 1
    assert collaboration_server.call_args[0][0].pk == recent.pk


def test_commands_migrate_documents_created_before(collaboration_server):
    """A document created after the cutover has no legacy content to migrate."""
    old = factories.DocumentFactory()
    models.Document.objects.filter(pk=old.pk).update(created_at="2020-01-01T00:00:00Z")
    factories.DocumentFactory()

    run_command(created_before="2021-01-01T00:00:00Z")

    assert collaboration_server.call_count == 1
    assert collaboration_server.call_args[0][0].pk == old.pk


def test_commands_migrate_documents_dry_run(collaboration_server):
    """A dry run should count the documents and call nothing."""
    factories.DocumentFactory.create_batch(2)

    output = run_command(dry_run=True)

    assert "2 documents to migrate" in output
    collaboration_server.assert_not_called()
    assert not models.DocumentMigration.objects.exists()


def test_commands_migrate_documents_document_id(collaboration_server):
    """Naming a document should hand over that one and leave the corpus alone."""
    factories.DocumentFactory.create_batch(3)
    document = factories.DocumentFactory()

    output = run_command(document_id=document.pk)

    assert collaboration_server.call_count == 1
    assert collaboration_server.call_args[0][0].pk == document.pk
    assert models.DocumentMigration.objects.get().document_id == document.pk
    assert "ok=1" in output


def test_commands_migrate_documents_document_id_already_migrated(
    collaboration_server,
):
    """
    A document already recorded as done should be handed over again when named.

    Asking for a document by its id is an instruction, not a filter over what is
    left to do: the collaboration server answers "already" when it has nothing
    to replay, which is the answer the run records.
    """
    document = factories.DocumentFactory()
    run_command()
    collaboration_server.return_value = migrated(status="already")

    run_command(document_id=document.pk)

    assert collaboration_server.call_count == 2
    assert (
        models.DocumentMigration.objects.get(document=document).status
        == models.DocumentMigrationStatus.ALREADY
    )


def test_commands_migrate_documents_document_id_unknown(collaboration_server):
    """An id that is no document should stop the command, not migrate nothing."""
    with pytest.raises(CommandError, match="No document with id"):
        run_command(document_id=uuid.uuid4())

    collaboration_server.assert_not_called()
