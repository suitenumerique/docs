"""Test the `create_demo` management command"""

from unittest import mock

from django.core.management import call_command
from django.test import override_settings

import pytest

from core import models

pytestmark = pytest.mark.django_db


@mock.patch(
    "demo.defaults.NB_OBJECTS",
    {
        "users": 10,
        "docs": 10,
        "max_users_per_document": 5,
    },
)
@override_settings(DEBUG=True)
def test_commands_create_demo():
    """The create_demo management command should create objects as expected."""
    call_command("create_demo")

    assert models.Template.objects.count() == 1
    assert models.User.objects.count() >= 10
    assert models.Document.objects.count() >= 10
    assert models.DocumentAccess.objects.count() > 10

    # assert dev users have doc accesses
    user = models.User.objects.get(email="impress@impress.world")
    assert models.DocumentAccess.objects.filter(user=user).exists()
    user = models.User.objects.get(email="user@webkit.e2e")
    assert models.DocumentAccess.objects.filter(user=user).exists()
    user = models.User.objects.get(email="user@firefox.e2e")
    assert models.DocumentAccess.objects.filter(user=user).exists()
    user = models.User.objects.get(email="user@chromium.e2e")
    assert models.DocumentAccess.objects.filter(user=user).exists()
