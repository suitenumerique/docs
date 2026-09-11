"""
Tests for the `sync_service_deletions_in_cascade` Celery task in the
core.tasks.documents module.
"""

from unittest import mock

import pytest

from core import factories
from core.services.yhub_services import ServiceUnavailableError
from core.tasks.documents import sync_service_deletions_in_cascade

pytestmark = pytest.mark.django_db


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_deletions_deletes_the_document(mock_service):
    """A deleted document should be deleted on the collaboration server."""
    document = factories.DocumentFactory()
    document.soft_delete()

    sync_service_deletions_in_cascade(str(document.id))

    mock_service.return_value.delete_ydoc.assert_called_once_with(document)
    mock_service.return_value.restore_ydoc.assert_not_called()


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_deletions_in_cascade(mock_service):
    """
    Deleting a document deletes the subtree under it, so the whole subtree
    should be deleted, the document itself included and its ancestors left out.
    """
    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    child = factories.DocumentFactory(parent=document)
    grand_child = factories.DocumentFactory(parent=child)
    factories.DocumentFactory()  # a document of another tree
    document.soft_delete()

    sync_service_deletions_in_cascade(str(document.id))

    assert mock_service.return_value.delete_ydoc.call_args_list == [
        mock.call(document),
        mock.call(child),
        mock.call(grand_child),
    ]


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_deletions_restores_the_document(mock_service):
    """A document that is back should be restored on the collaboration server."""
    document = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=document)
    document.soft_delete()
    document.restore()

    sync_service_deletions_in_cascade(str(document.id))

    assert mock_service.return_value.restore_ydoc.call_args_list == [
        mock.call(document),
        mock.call(child),
    ]
    mock_service.return_value.delete_ydoc.assert_not_called()


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_deletions_restore_leaves_out_what_stays_deleted(mock_service):
    """
    A document deleted on its own before its ancestor was stays deleted when
    the ancestor comes back, and so should its content.
    """
    document = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=document)
    grand_child = factories.DocumentFactory(parent=child)
    child.soft_delete()
    document.soft_delete()
    document.restore()

    sync_service_deletions_in_cascade(str(document.id))

    # the subtree of the child was deleted on its own and is still deleted
    assert mock_service.return_value.restore_ydoc.call_args_list == [
        mock.call(document)
    ]
    assert mock_service.return_value.delete_ydoc.call_args_list == [
        mock.call(child),
        mock.call(grand_child),
    ]


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_deletions_unknown_document(mock_service):
    """A document deleted for good in the meantime should not reach the service."""
    sync_service_deletions_in_cascade("d43ea3c5-b8ee-4a4a-9c60-2ad7a1d9e6cf")

    mock_service.return_value.delete_ydoc.assert_not_called()
    mock_service.return_value.restore_ydoc.assert_not_called()


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_deletions_keeps_going_on_failure(mock_service):
    """A document failing should not deprive the ones after it of their deletion."""
    document = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=document)
    document.soft_delete()
    mock_service.return_value.delete_ydoc.side_effect = [
        ServiceUnavailableError("yhub is down"),
        None,
    ]

    sync_service_deletions_in_cascade(str(document.id))

    assert mock_service.return_value.delete_ydoc.call_args_list == [
        mock.call(document),
        mock.call(child),
    ]
