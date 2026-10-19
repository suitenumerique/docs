"""
Tests for Documents API endpoint in impress's core app: update
"""
# pylint: disable=too-many-lines

import random
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import serializers
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach, role",
    [
        ("restricted", "reader"),
        ("restricted", "editor"),
        ("authenticated", "reader"),
        ("authenticated", "editor"),
        ("public", "reader"),
    ],
)
def test_api_documents_update_anonymous_forbidden(reach, role, via_parent):
    """
    Anonymous users should not be allowed to update a document when link
    configuration does not allow it.
    """
    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = APIClient().put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }

    document.refresh_from_db()
    document_values = serializers.DocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach,role",
    [
        ("public", "reader"),
        ("authenticated", "reader"),
        ("restricted", "reader"),
        ("restricted", "editor"),
    ],
)
def test_api_documents_update_authenticated_unrelated_forbidden(
    reach, role, via_parent
):
    """
    Authenticated users should not be allowed to update a document to which
    they are not related if the link configuration does not allow it.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory(),
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    document_values = serializers.DocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "is_authenticated,reach,role",
    [
        (False, "public", "editor"),
        (True, "public", "editor"),
        (True, "authenticated", "editor"),
    ],
)
def test_api_documents_update_anonymous_or_authenticated_unrelated(
    is_authenticated, reach, role, via_parent
):
    """
    Anonymous and authenticated users should be able to update a document to which
    they are not related if the link configuration allows it.
    """
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory(with_owned_document=True)
        client.force_login(user)
    else:
        user = AnonymousUser()

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory(),
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document = models.Document.objects.get(pk=document.pk)
    document_values = serializers.DocumentSerializer(instance=document).data
    for key, value in document_values.items():
        if key in [
            "id",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "accesses",
            "created_at",
            "creator",
            "depth",
            "link_reach",
            "link_role",
            "numchild",
            "path",
        ]:
            assert value == old_document_values[key]
        elif key == "updated_at":
            assert value > old_document_values[key]
        else:
            assert value == new_document_values[key]


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_update_authenticated_reader(via, via_parent, mock_user_teams):
    """
    Users who are reader of a document should not be allowed to update it.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role="reader"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role="reader"
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    document_values = serializers.DocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_update_authenticated_editor_administrator_or_owner(
    via, role, via_parent, mock_user_teams
):
    """A user who is editor, administrator or owner of a document should be allowed to update it."""
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role=role
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document = models.Document.objects.get(pk=document.pk)
    document_values = serializers.DocumentSerializer(instance=document).data
    for key, value in document_values.items():
        if key in [
            "id",
            "ancestors_link_reach",
            "ancestors_link_role",
            "computed_link_reach",
            "computed_link_role",
            "created_at",
            "creator",
            "depth",
            "link_reach",
            "link_role",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
        ]:
            assert value == old_document_values[key]
        elif key == "updated_at":
            assert value > old_document_values[key]
        else:
            assert value == new_document_values[key]


@pytest.mark.parametrize("via", VIA)
def test_api_documents_update_administrator_or_owner_of_another(via, mock_user_teams):
    """
    Being administrator or owner of a document should not grant authorization to update
    another document.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role=random.choice(["administrator", "owner"])
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document,
            team="lasuite",
            role=random.choice(["administrator", "owner"]),
        )

    other_document = factories.DocumentFactory(title="Old title", link_role="reader")
    old_document_values = serializers.DocumentSerializer(instance=other_document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{other_document.id!s}/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403

    other_document.refresh_from_db()
    other_document_values = serializers.DocumentSerializer(instance=other_document).data
    assert other_document_values == old_document_values


# =============================================================================
# PATCH tests
# =============================================================================


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach, role",
    [
        ("restricted", "reader"),
        ("restricted", "editor"),
        ("authenticated", "reader"),
        ("authenticated", "editor"),
        ("public", "reader"),
    ],
)
def test_api_documents_patch_anonymous_forbidden(reach, role, via_parent):
    """
    Anonymous users should not be allowed to patch a document when link
    configuration does not allow it.
    """
    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data

    response = APIClient().patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"title": "new title"},
        format="json",
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }

    document.refresh_from_db()
    assert serializers.DocumentSerializer(instance=document).data == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach,role",
    [
        ("public", "reader"),
        ("authenticated", "reader"),
        ("restricted", "reader"),
        ("restricted", "editor"),
    ],
)
def test_api_documents_patch_authenticated_unrelated_forbidden(reach, role, via_parent):
    """
    Authenticated users should not be allowed to patch a document to which
    they are not related if the link configuration does not allow it.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"title": "new title"},
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    assert serializers.DocumentSerializer(instance=document).data == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "is_authenticated,reach,role",
    [
        (False, "public", "editor"),
        (True, "public", "editor"),
        (True, "authenticated", "editor"),
    ],
)
def test_api_documents_patch_anonymous_or_authenticated_unrelated(
    is_authenticated, reach, role, via_parent
):
    """
    Anonymous and authenticated users should be able to patch a document to which
    they are not related if the link configuration allows it.
    """
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory(with_owned_document=True)
        client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    old_path = document.path

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"title": "new title"},
        format="json",
    )
    assert response.status_code == 200

    # Using document.refresh_from_db does not wirk because the content is in cache.
    # Force reloading it by fetching the document in the database.
    document = models.Document.objects.get(id=document.id)
    assert document.path == old_path
    assert document.title == "new title"
    document_values = serializers.DocumentSerializer(instance=document).data
    for key in [
        "id",
        "link_reach",
        "link_role",
        "creator",
        "depth",
        "numchild",
        "path",
    ]:
        assert document_values[key] == old_document_values[key]


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_patch_authenticated_reader(via, via_parent, mock_user_teams):
    """Users who are reader of a document should not be allowed to patch it."""
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role="reader"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role="reader"
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"title": "new title"},
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    assert serializers.DocumentSerializer(instance=document).data == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_patch_authenticated_editor_administrator_or_owner(
    via, role, via_parent, mock_user_teams
):
    """A user who is editor, administrator or owner of a document should be allowed to patch it."""
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role=role
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data
    old_path = document.path

    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"title": "new title"},
        format="json",
    )
    assert response.status_code == 200

    # Using document.refresh_from_db does not wirk because the content is in cache.
    # Force reloading it by fetching the document in the database.
    document = models.Document.objects.get(id=document.id)
    assert document.path == old_path
    assert document.title == "new title"
    document_values = serializers.DocumentSerializer(instance=document).data
    for key in [
        "id",
        "link_reach",
        "link_role",
        "creator",
        "depth",
        "numchild",
        "path",
        "nb_accesses_ancestors",
        "nb_accesses_direct",
    ]:
        assert document_values[key] == old_document_values[key]


@pytest.mark.parametrize("via", VIA)
def test_api_documents_patch_administrator_or_owner_of_another(via, mock_user_teams):
    """
    Being administrator or owner of a document should not grant authorization to patch
    another document.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role=random.choice(["administrator", "owner"])
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document,
            team="lasuite",
            role=random.choice(["administrator", "owner"]),
        )

    other_document = factories.DocumentFactory(title="Old title", link_role="reader")
    old_document_values = serializers.DocumentSerializer(instance=other_document).data

    response = client.patch(
        f"/api/v1.0/documents/{other_document.id!s}/",
        {"title": "new title"},
        format="json",
    )

    assert response.status_code == 403

    other_document.refresh_from_db()
    assert (
        serializers.DocumentSerializer(instance=other_document).data
        == old_document_values
    )


def test_api_documents_patch_empty_body():
    """
    Test when data is empty the document should not be updated.
    The `updated_at` property should not change asserting that no update in the database is made.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[(user, "owner")], creator=user)
    document_updated_at = document.updated_at

    old_document_values = serializers.DocumentSerializer(instance=document).data

    with patch("core.models.Document.save") as mock_document_save:
        response = client.patch(
            f"/api/v1.0/documents/{document.id!s}/",
            content_type="application/json",
        )
    mock_document_save.assert_not_called()
    assert response.status_code == 200

    document = models.Document.objects.get(id=document.id)
    new_document_values = serializers.DocumentSerializer(instance=document).data
    assert new_document_values == old_document_values
    assert document_updated_at == document.updated_at


@pytest.mark.parametrize("via", VIA)
def test_api_documents_patch_stale_instance_does_not_revert_link_configuration(
    via, mock_user_teams
):
    """
    A write must only save the fields the request carries.

    An editor patching a document from an instance loaded before an owner
    withdrew the link configuration must not put the old link configuration
    back: the patch saves the title only. This is the interleaving of the
    reported race condition, reproduced deterministically by loading the
    stale instance before the withdrawal and saving after it.
    """
    owner = factories.UserFactory()
    editor = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(editor)

    document = factories.DocumentFactory(
        link_reach="public", link_role="editor", title="before"
    )
    factories.UserDocumentAccessFactory(document=document, user=owner, role="owner")

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=editor, role="editor"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role="editor"
        )

    # The editor's request loads the document while it is still public.
    stale_document = models.Document.objects.get(pk=document.pk)

    # The owner withdraws the link in between.
    withdrawal = models.Document.objects.get(pk=document.pk)
    withdrawal.link_reach = models.LinkReachChoices.RESTRICTED
    withdrawal.link_role = models.LinkRoleChoices.READER
    withdrawal.save(update_fields=["link_reach", "link_role"])

    # The editor's write commits after the withdrawal.
    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"title": "written while revoked"},
        format="json",
    )
    assert response.status_code == 200

    # The withdrawal holds: the patch did not write the sharing columns back.
    document.refresh_from_db()
    assert document.title == "written while revoked"
    assert document.link_reach == models.LinkReachChoices.RESTRICTED
    assert document.link_role == models.LinkRoleChoices.READER

    # The stale instance the patch came from is left untouched for reference.
    assert stale_document.link_reach == models.LinkReachChoices.PUBLIC


def test_api_documents_patch_stale_instance_does_not_resurrect_soft_deletion():
    """
    A write loaded before a soft deletion must not undo the deletion by
    writing the deleted_at and ancestors_deleted_at columns back.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(title="to delete", users=[(user, "owner")])

    # The request loads the document while it is alive.
    stale_document = models.Document.objects.get(pk=document.pk)

    # The owner soft deletes it in between.
    document.soft_delete()

    # A write admitted before the deletion commits after it.
    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"title": "written while deleted"},
        format="json",
    )
    assert response.status_code in [200, 403, 404]

    document.refresh_from_db()
    assert document.deleted_at is not None
    assert document.ancestors_deleted_at is not None
    # The title may have been saved on the deleted document: what must hold is
    # that the deletion itself was not reverted.
    assert stale_document.deleted_at is None


def test_api_documents_patch_stale_instance_does_not_revert_path():
    """
    A write loaded before a move must not write the stale tree path back,
    which would leave the document under one parent and counted by another.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(title="to move", users=[(user, "owner")])
    old_path = document.path

    # The request loads the document before the move.
    models.Document.objects.get(pk=document.pk)

    # The owner moves it under another parent in between.
    new_parent = factories.DocumentFactory()
    document.move(new_parent, pos="last-child")

    # The write commits after the move.
    response = client.patch(
        f"/api/v1.0/documents/{document.id!s}/",
        {"title": "written after the move"},
        format="json",
    )
    assert response.status_code == 200

    document.refresh_from_db()
    assert document.title == "written after the move"
    assert document.path != old_path
    assert document.get_parent().id == new_parent.id


def test_api_documents_update_stale_instance_does_not_revert_link_configuration():
    """
    Same lost update through a full PUT: an update carrying only writable
    fields must not rewrite the read-only link columns of the row.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        link_reach="public", link_role="editor", title="old title"
    )
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    # The request loads the document while it is still public.
    models.Document.objects.get(pk=document.pk)

    # The owner withdraws the link in between.
    withdrawal = models.Document.objects.get(pk=document.pk)
    withdrawal.link_reach = models.LinkReachChoices.RESTRICTED
    withdrawal.link_role = models.LinkRoleChoices.READER
    withdrawal.save(update_fields=["link_reach", "link_role"])

    # The write commits after the withdrawal: PUT with the writable fields only.
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        {"title": "written while revoked", "excerpt": "excerpt"},
        format="json",
    )
    assert response.status_code == 200

    document.refresh_from_db()
    assert document.title == "written while revoked"
    assert document.link_reach == models.LinkReachChoices.RESTRICTED
    assert document.link_role == models.LinkRoleChoices.READER
