"""Test the `create_legacy_documents` management command"""

import base64
import json
from unittest import mock
from uuid import uuid4

from django.core.files.storage import default_storage
from django.core.management import call_command

import pytest

from core import factories, models
from core.services.yhub_services import APIError, YHubService
from core.utils.yjs import base64_yjs_to_xml

from demo.management.commands import create_legacy_documents as command

pytestmark = pytest.mark.django_db

FIXTURE = command.FIXTURE
DATA = json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture(name="data")
def data_fixture(tmp_path, monkeypatch):
    """
    The fixture, with ids of its own: the tests run in parallel, and the ids
    name the objects of the shared bucket.
    """
    text = FIXTURE.read_text(encoding="utf-8")
    for document in DATA["documents"]:
        text = text.replace(document["id"], str(uuid4()))
    path = tmp_path / "legacy_documents.json"
    path.write_text(text, encoding="utf-8")
    monkeypatch.setattr(command, "FIXTURE", path)
    return json.loads(text)


@pytest.fixture(name="append_ydoc", autouse=True)
def append_ydoc_fixture():
    """The collaboration server, taking the edits of the users."""
    calls = []

    def append(service, document, update):
        calls.append((service.user_id, str(document.id), update))

    with mock.patch.object(
        YHubService, "append_ydoc", autospec=True, side_effect=append
    ):
        yield calls


@pytest.fixture(name="s3")
def s3_fixture():
    """The media bucket, cleared after the session by the conftest."""
    return default_storage.connection.meta.client


def read(s3, key):
    """The latest version of an object of the media bucket."""
    return s3.get_object(Bucket=default_storage.bucket_name, Key=key)


def test_fixture_is_yjs_13_blocknote_content():
    """Every revision is an update the Yjs 13 reader takes, holding BlockNote blocks."""
    for document in DATA["documents"]:
        for revision in document["revisions"]:
            assert base64_yjs_to_xml(revision).startswith("<blockGroup><blockContainer")


def test_commands_create_legacy_documents(data, s3):
    """The documents are created where the collaboration server migrates them from."""
    root_data, *children = data["documents"]

    call_command("create_legacy_documents")

    owner = models.User.objects.get(email="docs@example.com")
    assert str(owner.id) == data["owner"]["id"]
    assert owner.full_name == data["owner"]["full_name"]
    assert not owner.has_usable_password()

    root = models.Document.objects.get(id=root_data["id"])
    assert root.is_root()
    assert root.link_reach == models.LinkReachChoices.RESTRICTED
    assert {str(child.id) for child in root.get_children()} == {
        child["id"] for child in children
    }
    assert models.DocumentAccess.objects.filter(
        document=root, user=owner, role=models.RoleChoices.OWNER
    ).exists()

    for document_data in data["documents"]:
        document = models.Document.objects.get(id=document_data["id"])
        assert document.title == document_data["title"]
        assert document.creator == owner

        # what Django used to store: the base64 of the update, as text
        body = read(s3, document.file_key)["Body"].read().decode("ascii")
        assert body == document_data["revisions"][-1]
        assert base64.b64decode(body)

        assert len(document.attachments) == len(document_data["attachments"])
        for key in document.attachments:
            head = s3.head_object(Bucket=default_storage.bucket_name, Key=key)
            assert head["Metadata"]["status"] == "ready"
            assert head["ContentLength"] > 0

        assert {str(thread.id) for thread in document.threads.all()} == {
            thread["id"] for thread in document_data["threads"]
        }
        for thread in document.threads.all():
            assert thread.comments.get().body[0]["type"] == "paragraph"


def test_commands_create_legacy_documents_attachments_are_valid(data, s3):
    """The generated attachments are files of their type."""
    call_command("create_legacy_documents")

    signatures = {
        "image/png": bytes.fromhex("89504e47"),
        "application/pdf": b"%PDF",
        "audio/wav": b"RIFF",
        "text/plain": b"A legacy",
    }
    keys = [
        key
        for document_data in data["documents"]
        for key in models.Document.objects.get(id=document_data["id"]).attachments
    ]
    assert len(keys) == len(signatures)
    for key in keys:
        response = read(s3, key)
        content = response["Body"].read()
        assert content.startswith(signatures[response["ContentType"]])


def test_commands_create_legacy_documents_existing_owner(data):
    """The user already signed in owns the documents."""
    user = factories.UserFactory(email="someone@example.com")

    call_command("create_legacy_documents", owner_email="someone@example.com")

    for document_data in data["documents"]:
        assert models.Document.objects.get(id=document_data["id"]).creator == user
    assert not models.User.objects.filter(id=data["owner"]["id"]).exists()


def test_commands_create_legacy_documents_twice(data, s3):
    """Run again by every deployment, the command leaves the documents alone."""
    ids = [document_data["id"] for document_data in data["documents"]]
    call_command("create_legacy_documents")
    root = models.Document.objects.get(id=ids[0])
    version = read(s3, root.file_key).get("VersionId")

    call_command("create_legacy_documents")

    assert models.Document.objects.filter(id__in=ids).count() == len(ids)
    assert models.Thread.objects.count() == sum(
        len(document_data["threads"]) for document_data in data["documents"]
    )
    assert read(s3, root.file_key).get("VersionId") == version


def test_commands_create_legacy_documents_edits(data, append_ydoc):
    """The edits are written in the name of their user, in order, once migrated."""
    call_command("create_legacy_documents")

    expected = [
        (edit["user_id"], document_data["id"], base64.b64decode(edit["update"]))
        for document_data in data["documents"]
        for edit in document_data["edits"]
    ]
    assert expected
    assert append_ydoc == expected

    root = models.Document.objects.get(id=data["documents"][0]["id"])
    for user_data in data["users"]:
        user = models.User.objects.get(email=user_data["email"])
        assert str(user.id) == user_data["id"]
        assert models.DocumentAccess.objects.filter(
            document=root, user=user, role=models.RoleChoices.EDITOR
        ).exists()

    # a thread started by a user is theirs
    threads = [
        thread
        for document_data in data["documents"]
        for thread in document_data["threads"]
        if thread["creator_id"]
    ]
    assert threads
    for thread in threads:
        assert (
            str(models.Thread.objects.get(id=thread["id"]).creator_id)
            == (thread["creator_id"])
        )


def test_commands_create_legacy_documents_edits_not_enabled(data):
    """Without the QA route, the documents are created without the edits."""
    with mock.patch.object(
        YHubService,
        "append_ydoc",
        side_effect=APIError("Not found", status_code=404),
    ) as append_ydoc:
        call_command("create_legacy_documents")

    assert append_ydoc.call_count == 1
    assert models.Document.objects.filter(id=data["documents"][0]["id"]).exists()


def test_commands_create_legacy_documents_edits_failing(data):
    """An edit the collaboration server refuses leaves nothing behind."""
    with (
        mock.patch.object(
            YHubService,
            "append_ydoc",
            side_effect=APIError("Unavailable", status_code=503),
        ),
        pytest.raises(APIError),
    ):
        call_command("create_legacy_documents")

    assert not models.Document.objects.filter(id=data["documents"][0]["id"]).exists()
