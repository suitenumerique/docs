"""Test the `create_load_test_sessions` and `revoke_load_test_sessions` commands."""

import json
import stat
from io import StringIO

from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.management import CommandError, call_command
from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories, models

from loadtest import sessions
from loadtest.management.commands import (
    create_load_test_sessions,
    revoke_load_test_sessions,
)

pytestmark = pytest.mark.django_db


def create(*args, **kwargs):
    """
    Run the creation command. The application is not installed by the `Test`
    configuration, so the command is handed over rather than looked up by name.
    """
    stdout = StringIO()
    call_command(create_load_test_sessions.Command(), *args, stdout=stdout, **kwargs)
    return stdout.getvalue()


def revoke(*args, **kwargs):
    """Run the revocation command."""
    stdout = StringIO()
    call_command(revoke_load_test_sessions.Command(), *args, stdout=stdout, **kwargs)
    return stdout.getvalue()


def who_am_i(session_key, settings):
    """Call the API with a session cookie, as a load generator would."""
    client = APIClient()
    client.cookies[settings.SESSION_COOKIE_NAME] = session_key
    return client.get("/api/v1.0/users/me/")


def test_commands_create_sessions_refused_when_disabled(settings, tmp_path):
    """Nothing should be minted where the tooling is not enabled."""
    settings.LOAD_TEST_TOOLS_ENABLED = False
    factories.UserDocumentAccessFactory()
    output = tmp_path / "manifest.json"

    with pytest.raises(CommandError, match="LOAD_TEST_TOOLS_ENABLED is not set"):
        create("1", output=str(output))

    assert not output.exists()
    assert cache.get(sessions.INDEX_CACHE_KEY) is None


def test_commands_create_sessions_refused_in_production(load_test_enabled, tmp_path):
    """Not even with the setting on, were it ever forced on a production."""
    load_test_enabled.ENVIRONMENT = "production"
    factories.UserDocumentAccessFactory()

    with pytest.raises(CommandError, match="never minted with the `Production`"):
        create("1", output=str(tmp_path / "manifest.json"))


def test_commands_revoke_sessions_refused_when_disabled(settings):
    """The revocation is part of the same tooling."""
    settings.LOAD_TEST_TOOLS_ENABLED = False

    with pytest.raises(CommandError, match="LOAD_TEST_TOOLS_ENABLED is not set"):
        revoke()


def test_commands_create_sessions_logs_users_in(load_test_enabled, tmp_path):
    """A minted session should be accepted by the API as a login of its user."""
    accesses = factories.UserDocumentAccessFactory.create_batch(3)
    output = tmp_path / "manifest.json"

    stdout = create("3", output=str(output))

    manifest = json.loads(output.read_text())
    assert manifest["cookie_name"] == load_test_enabled.SESSION_COOKIE_NAME
    assert {session["user_id"] for session in manifest["sessions"]} == {
        str(access.user_id) for access in accesses
    }
    for session in manifest["sessions"]:
        response = who_am_i(session["session_key"], load_test_enabled)
        assert response.status_code == 200
        assert response.json()["id"] == session["user_id"]

    # the keys are a secret: counted in the output, never shown
    assert "3 session(s) minted" in stdout
    for session in manifest["sessions"]:
        assert session["session_key"] not in stdout


@pytest.mark.usefixtures("load_test_enabled")
def test_commands_create_sessions_manifest_is_private(tmp_path):
    """The manifest should be readable by its owner alone, and never replaced silently."""
    factories.UserDocumentAccessFactory()
    output = tmp_path / "manifest.json"

    create("1", output=str(output))
    assert stat.S_IMODE(output.stat().st_mode) == 0o600
    first = json.loads(output.read_text())["sessions"][0]["session_key"]

    with pytest.raises(CommandError, match="already exists"):
        create("1", output=str(output))
    # the manifest was left alone, and the sessions nobody holds the keys of are gone
    assert json.loads(output.read_text())["sessions"][0]["session_key"] == first
    assert cache.get(sessions.INDEX_CACHE_KEY) is None

    output.chmod(0o644)
    create("1", output=str(output), force=True)
    assert stat.S_IMODE(output.stat().st_mode) == 0o600
    assert json.loads(output.read_text())["sessions"][0]["session_key"] != first


@pytest.mark.usefixtures("load_test_enabled")
def test_commands_create_sessions_selects_usable_users_only(tmp_path):
    """Staff, superusers, inactive users and users with nothing to open are left out."""
    expected = factories.UserDocumentAccessFactory().user
    factories.UserDocumentAccessFactory(user__is_staff=True)
    factories.UserDocumentAccessFactory(user__is_superuser=True)
    factories.UserDocumentAccessFactory(user__is_active=False)
    factories.UserFactory()
    deleted = factories.UserDocumentAccessFactory()
    now = timezone.now()
    models.Document.objects.filter(pk=deleted.document_id).update(
        deleted_at=now, ancestors_deleted_at=now
    )
    output = tmp_path / "manifest.json"

    stdout = create("10", output=str(output))

    manifest = json.loads(output.read_text())
    assert [session["user_id"] for session in manifest["sessions"]] == [
        str(expected.pk)
    ]
    assert "Only 1 of the 10 requested users" in stdout


@pytest.mark.usefixtures("load_test_enabled")
def test_commands_create_sessions_heaviest_users_first(tmp_path):
    """`--heaviest` should pick the users holding the most accesses."""
    light = factories.UserFactory()
    heavy = factories.UserFactory()
    factories.UserDocumentAccessFactory(user=light)
    factories.UserDocumentAccessFactory.create_batch(4, user=heavy)
    output = tmp_path / "manifest.json"

    create("1", heaviest=1, output=str(output))

    manifest = json.loads(output.read_text())
    assert [session["user_id"] for session in manifest["sessions"]] == [str(heavy.pk)]


@pytest.mark.usefixtures("load_test_enabled")
def test_commands_create_sessions_lists_documents_by_ability(tmp_path):
    """The documents of a user are split by what they may do, and capped."""
    user = factories.UserFactory()
    # the factory draws a link reach at random: keep these out of the public ones
    editable = [
        factories.UserDocumentAccessFactory(
            user=user, role=role, document__link_reach="restricted"
        ).document
        for role in ["editor", "administrator", "owner"]
    ]
    readonly = [
        factories.UserDocumentAccessFactory(
            user=user, role=role, document__link_reach="restricted"
        ).document
        for role in ["reader", "commenter"]
    ]
    public = factories.DocumentFactory(link_reach="public")
    factories.DocumentFactory(link_reach="restricted")
    output = tmp_path / "manifest.json"

    create("1", output=str(output))
    session = json.loads(output.read_text())["sessions"][0]
    assert set(session["editable_documents"]) == {str(doc.pk) for doc in editable}
    assert set(session["readonly_documents"]) == {str(doc.pk) for doc in readonly}
    assert json.loads(output.read_text())["public_documents"] == [str(public.pk)]

    create(
        "1", documents_per_user=1, public_documents=0, output=str(output), force=True
    )
    manifest = json.loads(output.read_text())
    assert len(manifest["sessions"][0]["editable_documents"]) == 1
    assert len(manifest["sessions"][0]["readonly_documents"]) == 1
    assert manifest["public_documents"] == []


@pytest.mark.usefixtures("load_test_enabled")
@pytest.mark.parametrize("ttl_hours", [0, -1, 169])
def test_commands_create_sessions_ttl_is_bounded(tmp_path, ttl_hours):
    """A session of a load test should not outlive the campaign by much."""
    factories.UserDocumentAccessFactory()

    with pytest.raises(CommandError, match="--ttl-hours"):
        create("1", ttl_hours=ttl_hours, output=str(tmp_path / "manifest.json"))

    assert cache.get(sessions.INDEX_CACHE_KEY) is None


def test_commands_revoke_sessions(load_test_enabled, tmp_path):
    """Every minted session should stop working, across runs, without the manifest."""
    factories.UserDocumentAccessFactory.create_batch(2)
    first, second = tmp_path / "first.json", tmp_path / "second.json"
    create("1", output=str(first))
    create("2", output=str(second))
    keys = [
        session["session_key"]
        for manifest in (first, second)
        for session in json.loads(manifest.read_text())["sessions"]
    ]
    assert len(keys) == 3
    assert all(who_am_i(key, load_test_enabled).status_code == 200 for key in keys)

    assert "3 session(s) revoked" in revoke()

    assert all(who_am_i(key, load_test_enabled).status_code == 401 for key in keys)
    assert "0 session(s) revoked" in revoke()


@pytest.mark.usefixtures("load_test_enabled")
def test_commands_create_sessions_to_storage():
    """A stored manifest goes under the load-test prefix, and is deleted on request."""
    factories.UserDocumentAccessFactory()

    stdout = create("1", storage_name="campaign.json")

    assert "loadtest/campaign.json" in stdout
    with default_storage.open("loadtest/campaign.json") as stored:
        manifest = json.loads(stored.read())
    assert len(manifest["sessions"]) == 1

    with pytest.raises(CommandError, match="already exists"):
        create("1", storage_name="campaign.json")

    assert "Manifest deleted." in revoke(storage_name="campaign.json")
    assert not default_storage.exists("loadtest/campaign.json")
    assert "No such manifest" in revoke(storage_name="campaign.json")


@pytest.mark.usefixtures("load_test_enabled")
@pytest.mark.parametrize(
    "name", ["../escape.json", "a/b.json", "/etc/passwd", ".hidden", ""]
)
def test_commands_create_sessions_storage_name_cannot_leave_the_prefix(name):
    """The name of a stored manifest is a name, not a path."""
    factories.UserDocumentAccessFactory()

    with pytest.raises(CommandError):
        create("1", storage_name=name)

    assert cache.get(sessions.INDEX_CACHE_KEY) is None
