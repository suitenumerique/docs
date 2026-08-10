"""Test the `create_demo` management command"""

from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

import pytest

from core import models
from core.services.yhub_services import ServiceUnavailableError, YHubService
from core.utils.yjs import yjs_to_text, yjs_to_xml

pytestmark = pytest.mark.django_db


@pytest.fixture(name="collaboration_server", autouse=True)
def collaboration_server_fixture():
    """
    Take the content of the demo documents, as the collaboration server does.

    It owns the content now, so building the demo corpus calls it once per
    document.
    """
    with mock.patch.object(YHubService, "create_ydoc") as mock_create_ydoc:
        yield mock_create_ydoc


@mock.patch(
    "demo.defaults.NB_OBJECTS",
    {
        "users": 10,
        "docs": 10,
        "max_users_per_document": 5,
    },
)
@override_settings(DEBUG=True)
def test_commands_create_demo(collaboration_server):
    """The create_demo management command should create objects as expected."""
    call_command("create_demo")

    assert models.User.objects.count() >= 10
    assert models.Document.objects.count() >= 10
    assert models.DocumentAccess.objects.count() > 10

    # every document was seeded with its content in the collaboration server,
    # and nothing was written to the object storage
    assert collaboration_server.call_count == 10
    seeded = {call.args[0].id for call in collaboration_server.call_args_list}
    assert seeded == set(models.Document.objects.values_list("id", flat=True))
    for call in collaboration_server.call_args_list:
        document, update = call.args
        assert document.content is None

        # the structure BlockNote stores, so the editor opens a real document
        xml = yjs_to_xml(update)
        assert xml.startswith("<blockGroup><blockContainer")
        assert xml.count("<blockContainer") > 3
        # a title, as the number BlockNote reads a heading level as
        assert "<heading" in xml and 'level="1"' in xml

        # it opens on the title of the document, and says a lot more than it
        text = yjs_to_text(update)
        assert text.startswith(document.title)
        assert len(text) > len(document.title)

    # assert dev users have doc accesses
    user = models.User.objects.get(email="impress@impress.world")
    assert models.DocumentAccess.objects.filter(user=user).exists()
    user = models.User.objects.get(email="user.test@webkit.test")
    assert models.DocumentAccess.objects.filter(user=user).exists()
    user = models.User.objects.get(email="user.test@firefox.test")
    assert models.DocumentAccess.objects.filter(user=user).exists()
    user = models.User.objects.get(email="user.test@chromium.test")
    assert models.DocumentAccess.objects.filter(user=user).exists()


@mock.patch(
    "demo.defaults.NB_OBJECTS",
    {"users": 2, "docs": 2, "max_users_per_document": 1},
)
@override_settings(DEBUG=True)
def test_commands_create_demo_without_collaboration_server(collaboration_server):
    """
    A demo of empty documents is not a demo: the command should say what is wrong.

    Nothing else holds the content, so a failure to seed it cannot be shrugged
    off as it could when Django still wrote it to its object storage.
    """
    collaboration_server.side_effect = ServiceUnavailableError("yhub is unreachable")

    with pytest.raises(CommandError, match="Is the collaboration server running?"):
        call_command("create_demo")
