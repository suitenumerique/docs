"""Tests for the user admin class."""

from datetime import timedelta
from unittest import mock

from django.contrib import admin
from django.core import mail
from django.test import RequestFactory
from django.utils import timezone

import pytest

from core import factories, models
from core.admin import UserAdmin

pytestmark = pytest.mark.django_db


def _admin_client(client):
    """Log a superuser in the client."""
    client.force_login(factories.UserFactory(is_staff=True, is_superuser=True))
    return client


def test_admin_users_duplicate_email_filter(client):
    """The filter should keep the users sharing their email, case ignored."""
    first = factories.UserFactory(email="john.doe@example.com")
    second = factories.UserFactory(email="JOHN.DOE@example.com")
    factories.UserFactory(email="jane.doe@example.com")
    factories.UserFactory(email=None)

    response = _admin_client(client).get("/admin/core/user/?duplicate_email=yes")

    assert response.status_code == 200
    assert {user.pk for user in response.context["cl"].result_list} == {
        first.pk,
        second.pk,
    }


def test_admin_users_merge_users_form(client):
    """The merge action should first ask for the user to merge into."""
    user = factories.UserFactory()

    response = _admin_client(client).post(
        "/admin/core/user/",
        {"action": "merge_users", "_selected_action": [user.pk], "index": 0},
    )

    assert response.status_code == 200
    assert response.templates[0].name == "core/admin/merge_users.html"
    assert str(user.pk) in response.content.decode()


def test_admin_users_merge_users(client, django_capture_on_commit_callbacks):
    """The merge action should move the data of the selected users and deactivate them."""
    target = factories.UserFactory(email="john.doe@example.com")
    duplicate = factories.UserFactory(email="JOHN.DOE@example.com")
    document = factories.DocumentFactory(
        creator=duplicate, users=[(duplicate, "owner")]
    )

    with django_capture_on_commit_callbacks(execute=True):
        response = _admin_client(client).post(
            "/admin/core/user/",
            {
                "action": "merge_users",
                "_selected_action": [duplicate.pk, target.pk],
                "apply": "1",
                "user": target.pk,
            },
        )

    assert response.status_code == 302
    duplicate.refresh_from_db()
    target.refresh_from_db()
    document.refresh_from_db()
    assert not duplicate.is_active
    assert target.is_active
    assert document.creator == target
    assert document.accesses.get().user == target
    reconciliation = models.UserReconciliation.objects.get()
    assert reconciliation.active_user == target
    assert reconciliation.inactive_user == duplicate
    assert reconciliation.status == "done"
    # pylint: disable-next=no-member
    assert [email.to for email in mail.outbox] == [[target.email]]


def test_admin_users_merge_users_rolled_back(
    client, django_capture_on_commit_callbacks
):
    """
    When a merge fails, the merges done before it in the action are rolled back,
    and no email should tell their users that their accounts were merged.
    """
    target = factories.UserFactory(email="john.doe@example.com")
    duplicates = factories.UserFactory.create_batch(2, email="john.doe@example.com")
    prepare = models.UserReconciliation.prepare_thread_reconciliation
    processed = []

    def prepare_or_fail(reconciliation):
        """Process the first reconciliation, fail on the second."""
        if processed:
            raise RuntimeError("failed")
        processed.append(reconciliation)
        return prepare(reconciliation)

    with (
        mock.patch.object(
            models.UserReconciliation,
            "prepare_thread_reconciliation",
            autospec=True,
            side_effect=prepare_or_fail,
        ),
        django_capture_on_commit_callbacks(execute=True),
        pytest.raises(RuntimeError, match="failed"),
    ):
        _admin_client(client).post(
            "/admin/core/user/",
            {
                "action": "merge_users",
                "_selected_action": [user.pk for user in duplicates],
                "apply": "1",
                "user": target.pk,
            },
        )

    assert len(processed) == 1
    # pylint: disable-next=no-member
    assert not mail.outbox
    assert not models.UserReconciliation.objects.exists()
    assert all(
        models.User.objects.filter(pk__in=[user.pk for user in duplicates]).values_list(
            "is_active", flat=True
        )
    )


def test_admin_users_merge_users_without_email(client):
    """The merge action should refuse users without email."""
    target = factories.UserFactory(email="john.doe@example.com")
    duplicate = factories.UserFactory(email=None)

    response = _admin_client(client).post(
        "/admin/core/user/",
        {
            "action": "merge_users",
            "_selected_action": [duplicate.pk],
            "apply": "1",
            "user": target.pk,
        },
        follow=True,
    )

    assert response.status_code == 200
    assert "Users without email cannot be merged." in response.content.decode()
    assert not models.UserReconciliation.objects.exists()
    duplicate.refresh_from_db()
    assert duplicate.is_active


def test_admin_users_merge_users_into_inactive_user(client):
    """The merge action should refuse an inactive user as target."""
    target = factories.UserFactory(is_active=False)
    duplicate = factories.UserFactory()

    response = _admin_client(client).post(
        "/admin/core/user/",
        {
            "action": "merge_users",
            "_selected_action": [duplicate.pk],
            "apply": "1",
            "user": target.pk,
        },
    )

    assert response.status_code == 200
    assert response.templates[0].name == "core/admin/merge_users.html"
    assert list(response.context["form"].errors) == ["user"]
    assert not models.UserReconciliation.objects.exists()


def test_admin_users_deactivate_duplicates():
    """The action should keep the most recently used user of each email."""
    now = timezone.now()
    kept = [
        factories.UserFactory(
            email="john.doe@example.com", last_login=now + timedelta(days=1)
        ),
        factories.UserFactory(email="jane.doe@example.com", last_login=None),
        factories.UserFactory(email="single@example.com", last_login=None),
        factories.UserFactory(email=None, last_login=None),
        factories.UserFactory(email=None, last_login=None),
    ]
    deactivated = [
        factories.UserFactory(email="JOHN.DOE@example.com", last_login=now),
        factories.UserFactory(email="john.doe@example.com", last_login=None),
        factories.UserFactory(email="jane.doe@example.com", last_login=now),
    ]
    # Without last login, the creation date counts
    kept[1].created_at = now + timedelta(days=1)
    kept[1].save()
    request = RequestFactory().post("/")

    with mock.patch.object(UserAdmin, "message_user") as message_user:
        admin.site.get_model_admin(models.User).deactivate_duplicates(
            request, models.User.objects.all()
        )

    assert set(models.User.objects.filter(is_active=True)) == set(kept)
    assert set(models.User.objects.filter(is_active=False)) == set(deactivated)
    message_user.assert_called_once_with(request, "3 users deactivated.")


def test_admin_users_deactivate_duplicates_keeps_an_active_user():
    """The action should keep an active user rather than a more recent inactive one."""
    now = timezone.now()
    active = factories.UserFactory(email="john.doe@example.com", last_login=now)
    factories.UserFactory(
        email="john.doe@example.com",
        last_login=now + timedelta(days=1),
        is_active=False,
    )
    request = RequestFactory().post("/")

    with mock.patch.object(UserAdmin, "message_user") as message_user:
        admin.site.get_model_admin(models.User).deactivate_duplicates(
            request, models.User.objects.all()
        )

    assert list(models.User.objects.filter(is_active=True)) == [active]
    message_user.assert_called_once_with(request, "1 users deactivated.")
