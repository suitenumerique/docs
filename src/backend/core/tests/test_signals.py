"""
Tests of the signals reporting the changes of accesses to the collaboration
server, whichever code changed them.
"""

from unittest import mock

import pytest

from core import factories, models

pytestmark = pytest.mark.django_db


def test_signals_document_access_created(
    mock_reset_service_connections, capture_service_resets
):
    """Creating an access should have the user's connections re-checked."""
    document = factories.DocumentFactory()
    user = factories.UserFactory()

    with capture_service_resets():
        models.DocumentAccess.objects.create(
            document=document, user=user, role="editor"
        )

    mock_reset_service_connections.assert_called_once_with(
        str(document.id), str(user.id)
    )


def test_signals_document_access_created_for_a_team(
    mock_reset_service_connections, capture_service_resets
):
    """An access granted to a team names nobody: every connection is re-checked."""
    document = factories.DocumentFactory()

    with capture_service_resets():
        models.DocumentAccess.objects.create(
            document=document, team="lasuite", role="reader"
        )

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_access_updated(
    mock_reset_service_connections, capture_service_resets
):
    """Saving an access, from wherever, should have the connections re-checked."""
    access = factories.UserDocumentAccessFactory(role="reader")

    with capture_service_resets():
        access.role = "editor"
        access.save()

    mock_reset_service_connections.assert_called_once_with(
        str(access.document_id), str(access.user_id)
    )


def test_signals_document_access_deleted(
    mock_reset_service_connections, capture_service_resets
):
    """Deleting an access should have the user's connections re-checked."""
    access = factories.UserDocumentAccessFactory()
    document_id, user_id = access.document_id, access.user_id

    with capture_service_resets():
        access.delete()

    mock_reset_service_connections.assert_called_once_with(
        str(document_id), str(user_id)
    )


def test_signals_document_accesses_deleted_in_bulk(
    mock_reset_service_connections, capture_service_resets
):
    """A queryset deletion goes through the signal for each access."""
    document = factories.DocumentFactory()
    accesses = factories.UserDocumentAccessFactory.create_batch(3, document=document)

    with capture_service_resets():
        models.DocumentAccess.objects.filter(document=document).delete()

    assert sorted(mock_reset_service_connections.call_args_list, key=str) == sorted(
        [mock.call(str(document.id), str(access.user_id)) for access in accesses],
        key=str,
    )


def test_signals_document_reset_is_queued_on_commit(mock_reset_service_connections):
    """Nothing is queued before the transaction is committed."""
    document = factories.DocumentFactory()

    models.DocumentAccess.objects.create(
        document=document, user=factories.UserFactory(), role="editor"
    )

    mock_reset_service_connections.assert_not_called()


def test_signals_document_link_definition_changed(
    mock_reset_service_connections, capture_service_resets
):
    """Changing the link definition of a document re-checks every connection."""
    document = factories.DocumentFactory(link_reach="restricted", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        document.link_reach = "public"
        document.save()

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_link_role_changed(
    mock_reset_service_connections, capture_service_resets
):
    """The link role is part of the link definition."""
    document = factories.DocumentFactory(link_reach="public", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        document.link_role = "editor"
        document.save()

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_link_definition_unchanged(
    mock_reset_service_connections, capture_service_resets
):
    """Saving a document without touching its link definition queues nothing."""
    document = factories.DocumentFactory(link_reach="public", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        document.title = "renamed"
        document.save()
        document.link_reach = "public"  # the value it already has
        document.save()

    mock_reset_service_connections.assert_not_called()


def test_signals_document_link_definition_saved_twice(
    mock_reset_service_connections, capture_service_resets
):
    """A change is reported once: the snapshot follows the save."""
    document = factories.DocumentFactory(link_reach="restricted", link_role="reader")
    document = models.Document.objects.get(pk=document.pk)

    with capture_service_resets():
        document.link_reach = "authenticated"
        document.save()
        document.save()

    mock_reset_service_connections.assert_called_once_with(str(document.id), None)


def test_signals_document_link_definition_refreshed(
    mock_reset_service_connections, capture_service_resets
):
    """Refreshing from the database takes a new snapshot."""
    document = factories.DocumentFactory(link_reach="restricted", link_role="reader")
    models.Document.objects.filter(pk=document.pk).update(link_reach="public")
    document.refresh_from_db()

    with capture_service_resets():
        document.save()

    mock_reset_service_connections.assert_not_called()


def test_signals_document_created(
    mock_reset_service_connections, capture_service_resets
):
    """A new document has no connection to re-check."""
    with capture_service_resets():
        factories.DocumentFactory(link_reach="public")

    mock_reset_service_connections.assert_not_called()
