"""Test the `create_legacy_documents` management command"""

import base64
import json
from datetime import timedelta
from unittest import mock

from django.core.files.storage import default_storage
from django.core.management import call_command
from django.utils import timezone

import pytest

from core import factories, models
from core.services.yhub_services import (
    APIError,
    ServiceUnavailableError,
    YHubService,
)
from core.utils.yjs import base64_yjs_to_xml

from demo.management.commands import create_legacy_documents as command

pytestmark = pytest.mark.django_db

DATA = json.loads(command.FIXTURE.read_text(encoding="utf-8"))
FIXTURE_IDS = [data["id"] for data in DATA["documents"]]


@pytest.fixture(name="append_ydoc", autouse=True)
def append_ydoc_fixture():
    """The collaboration server, taking the edits of the users."""
    calls = []

    def append(service, document, update, at=None):
        calls.append((service.user_id, str(document.id), update, at))

    with mock.patch.object(
        YHubService, "append_ydoc", autospec=True, side_effect=append
    ):
        yield calls


@pytest.fixture(name="migrate", autouse=True)
def migrate_fixture(append_ydoc):
    """
    The collaboration server, migrating the documents: each call records the
    document and how many edits were written before it.
    """
    calls = []

    def migrate(_service, document):
        calls.append((str(document.id), len(append_ydoc)))
        return {"status": "ok"}

    with mock.patch.object(YHubService, "migrate", autospec=True, side_effect=migrate):
        yield calls


@pytest.fixture(name="s3")
def s3_fixture():
    """The media bucket, cleared after the session by the conftest."""
    return default_storage.connection.meta.client


def read(s3, key):
    """The latest version of an object of the media bucket."""
    return s3.get_object(Bucket=default_storage.bucket_name, Key=key)


def seeded_trees():
    """The trees the command seeded, oldest first, each as {fixture id: document}."""
    title = DATA["documents"][0]["title"]
    trees = []
    for root in models.Document.get_root_nodes().filter(title__startswith=title):
        documents = [root, *root.get_descendants().order_by("path")]
        by_title = {document.title: document for document in documents}
        tree = {FIXTURE_IDS[0]: root}
        tree.update(
            {data["id"]: by_title[data["title"]] for data in DATA["documents"][1:]}
        )
        trees.append(tree)
    return trees


def seeded_tree():
    """The one tree the command seeded."""
    trees = seeded_trees()
    assert len(trees) == 1
    return trees[0]


def test_fixture_is_yjs_13_blocknote_content():
    """Every revision is an update the Yjs 13 reader takes, holding BlockNote blocks."""
    for document in DATA["documents"]:
        for revision in document["revisions"]:
            assert base64_yjs_to_xml(revision).startswith("<blockGroup><blockContainer")


def test_commands_create_legacy_documents(s3):
    """The documents are created where the collaboration server migrates them from."""
    call_command("create_legacy_documents")

    owner = models.User.objects.get(email="docs@example.com")
    assert str(owner.id) == DATA["owner"]["id"]
    assert owner.full_name == DATA["owner"]["full_name"]
    assert not owner.has_usable_password()

    tree = seeded_tree()
    root = tree[FIXTURE_IDS[0]]
    assert root.is_root()
    assert root.link_reach == models.LinkReachChoices.RESTRICTED
    # the history of the owner covers the edits dated days back
    access = models.DocumentAccess.objects.get(
        document=root, user=owner, role=models.RoleChoices.OWNER
    )
    assert access.created_at < timezone.now() - timedelta(days=20)

    for document_data in DATA["documents"]:
        document = tree[document_data["id"]]
        # fresh ids, not the ones of the fixture
        assert str(document.id) not in FIXTURE_IDS
        assert document.creator == owner

        if document_data["revisions"]:
            # what Django used to store: the base64 of the update, as text
            body = read(s3, document.file_key)["Body"].read().decode("ascii")
            assert len(base64.b64decode(body)) == len(
                base64.b64decode(document_data["revisions"][-1])
            )
            assert base64_yjs_to_xml(body).startswith("<blockGroup><blockContainer")

        assert len(document.attachments) == len(document_data["attachments"])
        for key in document.attachments:
            head = s3.head_object(Bucket=default_storage.bucket_name, Key=key)
            assert head["Metadata"]["status"] == "ready"
            assert head["ContentLength"] > 0

        assert document.threads.count() == len(document_data["threads"])
        for thread in document.threads.all():
            assert str(thread.id) not in json.dumps(DATA)
            assert thread.comments.get().body[0]["type"] == "paragraph"


def test_commands_create_legacy_documents_swaps_ids(s3):
    """The content points to the documents, threads and users of the run."""
    owner = factories.UserFactory(email="docs@example.com")

    call_command("create_legacy_documents")

    tree = seeded_tree()
    blocks = tree[DATA["documents"][1]["id"]]
    inline = tree[DATA["documents"][2]["id"]]
    content = base64.b64decode(read(s3, inline.file_key)["Body"].read())
    # a doc link to "Every block", a mention of the owner and a thread
    assert str(blocks.id).encode() in content
    assert str(owner.id).encode() in content
    assert str(inline.threads.first().id).encode() in content
    for fixture_id in [*FIXTURE_IDS, DATA["owner"]["id"]]:
        assert fixture_id.encode() not in content


def test_commands_create_legacy_documents_attachments_are_valid(s3):
    """The generated attachments are files of their type, named by a uuid."""
    call_command("create_legacy_documents")

    signatures = {
        "image/png": bytes.fromhex("89504e47"),
        "application/pdf": b"%PDF",
        "audio/wav": b"RIFF",
        "text/plain": b"A legacy",
    }
    tree = seeded_tree()
    keys = [key for document in tree.values() for key in document.attachments]
    assert len(keys) == len(signatures)
    for key in keys:
        # what the media urls take
        assert command.enums.MEDIA_STORAGE_URL_EXTRACT.search(f"/media/{key}")
        response = read(s3, key)
        content = response["Body"].read()
        assert content.startswith(signatures[response["ContentType"]])


def test_commands_create_legacy_documents_existing_owner():
    """The user already signed in owns the documents."""
    user = factories.UserFactory(email="someone@example.com")

    call_command("create_legacy_documents", owner_email="someone@example.com")

    tree = seeded_tree()
    assert {document.creator for document in tree.values()} == {user}
    assert not models.User.objects.filter(id=DATA["owner"]["id"]).exists()


def test_commands_create_legacy_documents_twice(append_ydoc):
    """Every run, every deployment, seeds a new tree."""
    call_command("create_legacy_documents")
    edits = len(append_ydoc)

    call_command("create_legacy_documents")

    trees = seeded_trees()
    assert len(trees) == 2
    first, second = trees[0], trees[1]
    assert not {document.id for document in first.values()} & {
        document.id for document in second.values()
    }
    assert len(append_ydoc) == 2 * edits


def test_commands_create_legacy_documents_migrated(migrate):
    """The documents with legacy content are migrated, before any edit."""
    call_command("create_legacy_documents")

    tree = seeded_tree()
    assert migrate == [
        (str(tree[data["id"]].id), 0) for data in DATA["documents"] if data["revisions"]
    ]


def test_commands_create_legacy_documents_migration_refused(capsys):
    """A document the collaboration server does not migrate is reported."""
    with mock.patch.object(YHubService, "migrate", return_value={"status": "empty"}):
        call_command("create_legacy_documents")

    migrated = [data for data in DATA["documents"] if data["revisions"]]
    assert capsys.readouterr().err.count("not migrated") == len(migrated)


def test_commands_create_legacy_documents_edits(append_ydoc):
    """The edits are written in the name of their user, in order, at their date."""
    before = timezone.now()
    call_command("create_legacy_documents")

    tree = seeded_tree()
    edits = [
        (edit, str(tree[document_data["id"]].id))
        for document_data in DATA["documents"]
        for edit in document_data["edits"]
    ]
    assert edits
    assert [(user_id, doc_id) for user_id, doc_id, _, _ in append_ydoc] == [
        (edit["user_id"], doc_id) for edit, doc_id in edits
    ]
    for (_, _, update, at), (edit, _) in zip(append_ydoc, edits, strict=True):
        assert update
        if edit.get("minutes_ago"):
            age = before - at
            assert (
                timedelta(minutes=edit["minutes_ago"]) - timedelta(minutes=1)
                < age
                < timedelta(minutes=edit["minutes_ago"]) + timedelta(minutes=1)
            )
        else:
            assert at is None

    root = tree[FIXTURE_IDS[0]]
    for user_data in DATA["users"]:
        user = models.User.objects.get(email=user_data["email"])
        assert str(user.id) == user_data["id"]
        assert models.DocumentAccess.objects.filter(
            document=root, user=user, role=models.RoleChoices.EDITOR
        ).exists()

    # a thread started by a user is theirs
    creators = {
        thread["comment"]: thread["creator_id"]
        for document_data in DATA["documents"]
        for thread in document_data["threads"]
        if thread["creator_id"]
    }
    assert creators
    for document in tree.values():
        for thread in document.threads.all():
            comment = thread.comments.get().body[0]["content"][0]["text"]
            if comment in creators:
                assert str(thread.creator_id) == creators[comment]


def test_commands_create_legacy_documents_edits_not_enabled():
    """Without the QA route, the documents are created without the edits."""
    with mock.patch.object(
        YHubService,
        "append_ydoc",
        side_effect=APIError("Not found", status_code=404),
    ) as append_ydoc:
        call_command("create_legacy_documents")

    assert append_ydoc.call_count == 1
    tree = seeded_tree()
    assert not models.DocumentAccess.objects.filter(
        document=tree[FIXTURE_IDS[0]], role=models.RoleChoices.EDITOR
    ).exists()


@pytest.fixture(name="no_retry_delay")
def no_retry_delay_fixture(monkeypatch):
    """Retries without waiting."""
    monkeypatch.setattr(command, "YHUB_RETRY_DELAY", 0)
    monkeypatch.setattr(command, "YHUB_ATTEMPTS", 3)


@pytest.mark.usefixtures("no_retry_delay")
def test_commands_create_legacy_documents_edits_failing():
    """An edit the collaboration server keeps refusing fails the command, retried first."""
    with (
        mock.patch.object(
            YHubService,
            "append_ydoc",
            side_effect=APIError("Unavailable", status_code=503),
        ) as append_ydoc,
        pytest.raises(APIError),
    ):
        call_command("create_legacy_documents")

    assert append_ydoc.call_count == 3


@pytest.mark.usefixtures("no_retry_delay")
def test_commands_create_legacy_documents_edits_waits_for_yhub():
    """A collaboration server still starting is waited for."""
    answers = [ServiceUnavailableError("Starting"), None]

    def append(*_args):
        answer = answers.pop(0) if answers else None
        if answer:
            raise answer

    with mock.patch.object(YHubService, "append_ydoc", side_effect=append):
        call_command("create_legacy_documents")

    tree = seeded_tree()
    assert models.DocumentAccess.objects.filter(
        document=tree[FIXTURE_IDS[0]], role=models.RoleChoices.EDITOR
    ).exists()
