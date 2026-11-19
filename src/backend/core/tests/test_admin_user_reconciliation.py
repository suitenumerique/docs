"""Tests for the user reconciliation admin class."""

from django.contrib.admin.widgets import AutocompleteSelect
from django.contrib.auth.models import Permission
from django.urls import reverse

import pytest

from core import factories, models

pytestmark = pytest.mark.django_db


def test_admin_user_reconciliation_add_form_uses_autocomplete(docs_admin_client):
    """The users should be picked with autocompletes, not selects loading all users."""
    users = factories.UserFactory.create_batch(3)

    response = docs_admin_client.get(reverse("admin:core_userreconciliation_add"))

    assert response.status_code == 200
    form = response.context["adminform"].form
    for field_name in ("active_user", "inactive_user"):
        assert isinstance(form.fields[field_name].widget.widget, AutocompleteSelect)
    # The emails are copied from the picked users
    assert "active_email" not in form.fields
    assert "inactive_email" not in form.fields
    assert "active_email" not in response.context["adminform"].readonly_fields
    content = response.content.decode()
    for user in users:
        assert str(user.pk) not in content


def test_admin_user_reconciliation_autocomplete_endpoint(docs_admin_client):
    """The autocomplete endpoint behind the widgets should search users by email."""
    factories.UserFactory(email="find-me@example.com")
    factories.UserFactory(email="someone-else@example.com")

    response = docs_admin_client.get(
        reverse("admin:autocomplete"),
        {
            "app_label": "core",
            "model_name": "userreconciliation",
            "field_name": "active_user",
            "term": "find-me",
        },
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["text"] == "find-me@example.com"


def test_admin_user_reconciliation_create(docs_admin_client):
    """Creating an entry should store the picked users and copy their emails."""
    active = factories.UserFactory(email="active@example.com")
    inactive = factories.UserFactory(email="inactive@example.com")

    response = docs_admin_client.post(
        reverse("admin:core_userreconciliation_add"),
        {
            "active_user": str(active.pk),
            "inactive_user": str(inactive.pk),
            "status": "pending",
        },
    )

    assert response.status_code == 302
    reconciliation = models.UserReconciliation.objects.get()
    assert reconciliation.active_user == active
    assert reconciliation.inactive_user == inactive
    assert reconciliation.active_email == "active@example.com"
    assert reconciliation.inactive_email == "inactive@example.com"
    assert reconciliation.status == "ready"


def test_admin_user_reconciliation_create_keeps_picked_user_sharing_email(
    docs_admin_client,
):
    """The picked user should be kept, not replaced by another one sharing its email."""
    factories.UserFactory.create_batch(2, email="shared@example.com")
    inactive = factories.UserFactory(email="inactive@example.com")
    # The user a lookup by email would find instead
    found_by_email = models.User.objects.filter(email="shared@example.com").first()
    picked = models.User.objects.filter(email="shared@example.com").exclude(
        pk=found_by_email.pk
    )[0]

    response = docs_admin_client.post(
        reverse("admin:core_userreconciliation_add"),
        {
            "active_user": str(picked.pk),
            "inactive_user": str(inactive.pk),
            "status": "pending",
        },
    )

    assert response.status_code == 302
    assert models.UserReconciliation.objects.get().active_user == picked


@pytest.mark.parametrize("field_name", ["active_user", "inactive_user"])
def test_admin_user_reconciliation_create_required_users(docs_admin_client, field_name):
    """Both users should be required."""
    user = factories.UserFactory()
    data = {"active_user": str(user.pk), "inactive_user": str(user.pk)}
    data[field_name] = ""

    response = docs_admin_client.post(
        reverse("admin:core_userreconciliation_add"), {**data, "status": "pending"}
    )

    assert response.status_code == 200
    assert field_name in response.context["adminform"].form.errors
    assert not models.UserReconciliation.objects.exists()


def test_admin_user_reconciliation_create_same_user(docs_admin_client):
    """The same user should not be both the active and the inactive one."""
    user = factories.UserFactory()

    response = docs_admin_client.post(
        reverse("admin:core_userreconciliation_add"),
        {
            "active_user": str(user.pk),
            "inactive_user": str(user.pk),
            "status": "pending",
        },
    )

    assert response.status_code == 200
    assert response.context["adminform"].form.errors["inactive_user"] == [
        "The user to deactivate must be another user."
    ]
    assert not models.UserReconciliation.objects.exists()


@pytest.mark.parametrize("email", [None, ""])
@pytest.mark.parametrize("field_name", ["active_user", "inactive_user"])
def test_admin_user_reconciliation_autocomplete_excludes_users_without_email(
    docs_admin_client, field_name, email
):
    """Users without email cannot confirm the reconciliation: they are not offered."""
    factories.UserFactory(email=email, full_name="Find Me")
    with_email = factories.UserFactory(email="find-me@example.com")

    response = docs_admin_client.get(
        reverse("admin:autocomplete"),
        {
            "app_label": "core",
            "model_name": "userreconciliation",
            "field_name": field_name,
            "term": "find",
        },
    )

    assert response.status_code == 200
    assert [result["id"] for result in response.json()["results"]] == [
        str(with_email.pk)
    ]


@pytest.mark.parametrize("email", [None, ""])
def test_admin_user_reconciliation_create_user_without_email(docs_admin_client, email):
    """A user without email posted anyway should be refused."""
    active = factories.UserFactory(email=email)
    inactive = factories.UserFactory()

    response = docs_admin_client.post(
        reverse("admin:core_userreconciliation_add"),
        {
            "active_user": str(active.pk),
            "inactive_user": str(inactive.pk),
            "status": "pending",
        },
    )

    assert response.status_code == 200
    assert "active_user" in response.context["adminform"].form.errors
    assert not models.UserReconciliation.objects.exists()


def test_admin_user_reconciliation_change(docs_admin_client):
    """Changing a user should update its email."""
    active = factories.UserFactory(email="active@example.com")
    inactive = factories.UserFactory(email="inactive@example.com")
    new_active = factories.UserFactory(email="new-active@example.com")
    reconciliation = models.UserReconciliation.objects.create(
        active_email=active.email,
        inactive_email=inactive.email,
        active_user=active,
        inactive_user=inactive,
        status="ready",
    )
    url = reverse("admin:core_userreconciliation_change", args=[reconciliation.pk])

    response = docs_admin_client.get(url)

    assert response.status_code == 200
    content = response.content.decode()
    assert f'<option value="{active.pk}" selected' in content
    assert f'<option value="{inactive.pk}" selected' in content
    assert str(new_active.pk) not in content

    response = docs_admin_client.post(
        url,
        {
            "active_user": str(new_active.pk),
            "inactive_user": str(inactive.pk),
            "status": "ready",
        },
    )

    assert response.status_code == 302
    reconciliation.refresh_from_db()
    assert reconciliation.active_user == new_active
    assert reconciliation.active_email == "new-active@example.com"
    assert reconciliation.inactive_user == inactive


def test_admin_user_reconciliation_change_form_view_only(client):
    """Staff allowed to view but not change reconciliations should see the entry."""
    active = factories.UserFactory(email="active@example.com")
    inactive = factories.UserFactory(email="inactive@example.com")
    reconciliation = models.UserReconciliation.objects.create(
        active_email=active.email,
        inactive_email=inactive.email,
        active_user=active,
        inactive_user=inactive,
        status="ready",
    )
    staff = factories.UserFactory(is_staff=True)
    staff.user_permissions.add(
        Permission.objects.get(codename="view_userreconciliation")
    )
    client.force_login(staff)

    response = client.get(
        reverse("admin:core_userreconciliation_change", args=[reconciliation.pk])
    )

    assert response.status_code == 200
    content = response.content.decode()
    assert "active@example.com" in content
    assert "inactive@example.com" in content


@pytest.mark.parametrize(
    "codenames, status_code",
    [
        (["add_userreconciliation"], 403),
        (["add_userreconciliation", "view_user"], 200),
    ],
)
def test_admin_user_reconciliation_autocomplete_needs_view_user(
    client, codenames, status_code
):
    """Searching the users needs the permission to view them, as documented."""
    factories.UserFactory(email="find-me@example.com")
    staff = factories.UserFactory(is_staff=True)
    staff.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    client.force_login(staff)

    response = client.get(
        reverse("admin:autocomplete"),
        {
            "app_label": "core",
            "model_name": "userreconciliation",
            "field_name": "active_user",
            "term": "find-me",
        },
    )

    assert response.status_code == status_code
