"""Tests for the document admin class."""

from unittest import mock

from django.contrib import admin, messages
from django.core.cache import cache
from django.test import RequestFactory

import pytest

from core import factories, models
from core.admin import TransferDocumentsForm
from core.utils.users import get_users_sharing_documents_with_cache_key

pytestmark = pytest.mark.django_db


def _document_admin():
    """Return the registered document admin."""
    return admin.site.get_model_admin(models.Document)


def _create_tree():
    """Create a document, a sub-document and a sub-sub-document, and two users."""
    alice, bob = factories.UserFactory.create_batch(2)
    root = factories.DocumentFactory(creator=alice)
    child = factories.DocumentFactory(parent=root, creator=bob)
    grandchild = factories.DocumentFactory(parent=child, creator=alice)
    return (root, child, grandchild), (alice, bob)


def _transfer(document, source, target, keep_source_accesses=False):
    """Run the transfer action on a document from a user to another."""
    data = {"apply": "1", "source": source.pk, "target": target.pk}
    if keep_source_accesses:
        data["keep_source_accesses"] = "on"
    request = RequestFactory().post("/", data)
    queryset = models.Document.objects.filter(pk=document.pk)
    with (
        mock.patch.object(type(_document_admin()), "message_user") as message_user,
        mock.patch("core.admin.trigger_subtree_document_indexer") as indexer,
    ):
        _document_admin().transfer_documents(request, queryset)
    return request, message_user, indexer


def _roles(document):
    """Return the roles on a document by user, or by team."""
    return {
        access.user_id or access.team: access.role for access in document.accesses.all()
    }


@pytest.mark.parametrize("keep_source_accesses", [False, True])
def test_admin_documents_transfer_documents(
    keep_source_accesses, django_capture_on_commit_callbacks
):
    """The action transfers the documents and accesses of a user in the selected trees."""
    (root, child, grandchild), (alice, bob) = _create_tree()
    carol = factories.UserFactory()
    deleted = factories.DocumentFactory(parent=child, creator=alice)
    deleted.soft_delete()
    outside = factories.DocumentFactory(creator=alice, users=[(alice, "owner")])
    factories.UserDocumentAccessFactory(document=root, user=alice, role="owner")
    factories.TeamDocumentAccessFactory(document=root, team="alice-team", role="owner")
    factories.UserDocumentAccessFactory(document=child, user=alice, role="editor")
    factories.UserDocumentAccessFactory(document=child, user=carol, role="reader")
    factories.UserDocumentAccessFactory(
        document=grandchild, user=carol, role="administrator"
    )
    factories.UserDocumentAccessFactory(document=grandchild, user=alice, role="reader")

    with django_capture_on_commit_callbacks(execute=True):
        request, message_user, indexer = _transfer(
            root, alice, carol, keep_source_accesses
        )

    creators = dict(models.Document.objects.values_list("id", "creator"))
    assert creators == {
        root.pk: carol.pk,
        child.pk: bob.pk,
        grandchild.pk: carol.pk,
        deleted.pk: carol.pk,
        outside.pk: alice.pk,
    }
    kept = {alice.pk: "owner"} if keep_source_accesses else {}
    assert _roles(root) == {**kept, carol.pk: "owner", "alice-team": "owner"}
    kept = {alice.pk: "editor"} if keep_source_accesses else {}
    assert _roles(child) == {**kept, carol.pk: "editor"}
    kept = {alice.pk: "reader"} if keep_source_accesses else {}
    assert _roles(grandchild) == {**kept, carol.pk: "administrator"}
    assert _roles(outside) == {alice.pk: "owner"}
    message_user.assert_called_once_with(
        request, f"3 documents and 3 accesses transferred from {alice} to {carol}."
    )
    indexer.assert_called_once_with({root.pk, child.pk, grandchild.pk})


def test_admin_documents_transfer_documents_moved_access(
    mock_reset_service_connections, capture_service_resets
):
    """
    An access moved to the target should refresh the connections of the source too,
    the signal of the access only seeing the target, and the sharing cache of both
    users once committed, once for the whole transfer.
    """
    (root, child, _grandchild), (alice, _bob) = _create_tree()
    carol = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=root, user=alice, role="owner")
    factories.UserDocumentAccessFactory(document=child, user=alice, role="editor")
    keys = [
        get_users_sharing_documents_with_cache_key(user.pk) for user in (alice, carol)
    ]

    with (
        mock.patch("core.admin.cache", wraps=cache) as admin_cache,
        capture_service_resets(),
    ):
        _transfer(root, alice, carol)
        # a request reading the accesses still committed caches them again
        # before the commit
        for key in keys:
            cache.set(key, {})
        admin_cache.delete_many.assert_not_called()

    admin_cache.delete_many.assert_called_once_with(keys)
    for user in (alice, carol):
        assert cache.get(get_users_sharing_documents_with_cache_key(user.pk)) is None
    # the documents in no particular order, the users of each one sorted
    assert sorted(
        call.args for call in mock_reset_service_connections.call_args_list
    ) == sorted(
        (str(document.pk), str(user.pk))
        for document in (root, child)
        for user in (alice, carol)
    )


def test_admin_documents_transfer_documents_form():
    """The action should ask for the users first, and refuse the same user twice."""
    (root, _child, _grandchild), (alice, _bob) = _create_tree()
    request = RequestFactory().post("/")
    request.user = factories.UserFactory(is_staff=True, is_superuser=True)

    response = _document_admin().transfer_documents(
        request, models.Document.objects.filter(pk=root.pk)
    )

    assert response.template_name == "core/admin/transfer_documents.html"
    assert f'value="{root.pk}"' in response.render().content.decode()
    form = TransferDocumentsForm({"source": alice.pk, "target": alice.pk})
    assert form.errors == {"__all__": ["The source and target users must differ."]}


def test_admin_documents_transfer_documents_inherited_access():
    """The target gets the role the source inherits on a selected sub-document."""
    (root, child, _grandchild), (alice, _bob) = _create_tree()
    carol = factories.UserFactory()
    factories.UserDocumentAccessFactory(document=root, user=alice, role="owner")

    request, message_user, _indexer = _transfer(child, alice, carol)

    assert _roles(root) == {alice.pk: "owner"}
    assert _roles(child) == {carol.pk: "owner"}
    message_user.assert_called_once_with(
        request, f"1 documents and 1 accesses transferred from {alice} to {carol}."
    )


def test_admin_documents_transfer_documents_autocomplete(client):
    """The users of the form should be searchable through the admin autocomplete."""
    client.force_login(factories.UserFactory(is_staff=True, is_superuser=True))
    user = factories.UserFactory(full_name="Carol Transfer")

    response = client.get(
        "/admin/autocomplete/",
        {
            "app_label": "core",
            "model_name": "document",
            "field_name": "creator",
            "term": "Carol Transfer",
        },
    )

    assert response.status_code == 200
    assert [result["id"] for result in response.json()["results"]] == [str(user.pk)]


def test_admin_documents_transfer_documents_none_left():
    """The action should do nothing when the selected documents are gone."""
    (root, _child, _grandchild), (alice, _bob) = _create_tree()
    carol = factories.UserFactory()
    request = RequestFactory().post(
        "/", {"apply": "1", "source": alice.pk, "target": carol.pk}
    )

    with mock.patch.object(type(_document_admin()), "message_user") as message_user:
        response = _document_admin().transfer_documents(
            request, models.Document.objects.none()
        )

    assert response is None
    message_user.assert_called_once_with(
        request, "No document left to transfer.", messages.WARNING
    )
    root.refresh_from_db()
    assert root.creator == alice
