"""
Tests for the `sync_service_restorations_in_cascade` and `delete_service_documents`
Celery tasks in the core.tasks.documents module.
"""

from unittest import mock

import pytest
from celery.exceptions import MaxRetriesExceededError

from core import factories
from core.services.yhub_services import ServiceUnavailableError
from core.tasks.documents import (
    delete_service_documents,
    sync_service_restorations_in_cascade,
)

pytestmark = pytest.mark.django_db


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_restorations_restores_the_document(mock_service):
    """A document that is back should be restored on the collaboration server."""
    document = factories.DocumentFactory()
    document.soft_delete()
    document.restore()

    sync_service_restorations_in_cascade(str(document.id))

    mock_service.return_value.restore_ydoc.assert_called_once_with(document)
    mock_service.return_value.delete_ydoc.assert_not_called()


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_restorations_in_cascade(mock_service):
    """
    Restoring a document restores the subtree that was deleted with it, the
    document itself included and its ancestors left out.
    """
    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    child = factories.DocumentFactory(parent=document)
    grand_child = factories.DocumentFactory(parent=child)
    factories.DocumentFactory()  # a document of another tree
    document.soft_delete()
    document.restore()

    sync_service_restorations_in_cascade(str(document.id))

    assert mock_service.return_value.restore_ydoc.call_args_list == [
        mock.call(document),
        mock.call(child),
        mock.call(grand_child),
    ]
    mock_service.return_value.delete_ydoc.assert_not_called()


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_restorations_leaves_out_what_stays_deleted(mock_service):
    """
    A document deleted on its own before its ancestor was stays deleted when
    the ancestor comes back: it is never reported to the collaboration server,
    whose room for it was never deleted in the first place — its access
    re-checks already make it read-only.
    """
    document = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=document)
    factories.DocumentFactory(parent=child)  # a grand child that stays deleted
    child.soft_delete()
    document.soft_delete()
    document.restore()

    sync_service_restorations_in_cascade(str(document.id))

    # the subtree of the child was deleted on its own and is still deleted
    assert mock_service.return_value.restore_ydoc.call_args_list == [
        mock.call(document)
    ]
    mock_service.return_value.delete_ydoc.assert_not_called()


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_restorations_ignores_a_still_deleted_document(mock_service):
    """
    A deletion is no longer reported to the collaboration server: a document
    whose room stays alive there must not be tombstoned by a stale report.
    """
    document = factories.DocumentFactory()
    document.soft_delete()

    sync_service_restorations_in_cascade(str(document.id))

    mock_service.return_value.delete_ydoc.assert_not_called()
    mock_service.return_value.restore_ydoc.assert_not_called()


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_restorations_unknown_document(mock_service):
    """A document deleted for good in the meantime should not reach the service."""
    sync_service_restorations_in_cascade("d43ea3c5-b8ee-4a4a-9c60-2ad7a1d9e6cf")

    mock_service.return_value.delete_ydoc.assert_not_called()
    mock_service.return_value.restore_ydoc.assert_not_called()


@mock.patch("core.tasks.documents.YHubService")
def test_sync_service_restorations_keeps_going_on_failure(mock_service):
    """A document failing should not deprive the ones after it of their restoration."""
    document = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=document)
    document.soft_delete()
    document.restore()
    mock_service.return_value.restore_ydoc.side_effect = [
        ServiceUnavailableError("yhub is down"),
        None,
    ]

    sync_service_restorations_in_cascade(str(document.id))

    assert mock_service.return_value.restore_ydoc.call_args_list == [
        mock.call(document),
        mock.call(child),
    ]


@mock.patch("core.tasks.documents.YHubService")
def test_delete_service_documents(mock_service):
    """Documents deleted for good are deleted on the collaboration server by id."""
    result = delete_service_documents.apply(args=[["first-id", "second-id"]])

    assert result.successful()

    assert mock_service.return_value.delete_ydoc.call_args_list == [
        mock.call("first-id"),
        mock.call("second-id"),
    ]


@mock.patch("core.tasks.documents.YHubService")
def test_delete_service_documents_retries_the_failed_ones(mock_service):
    """A document failing should not stop the others, and be retried, alone."""
    mock_service.return_value.delete_ydoc.side_effect = [
        ServiceUnavailableError("yhub is down"),
        None,
        ServiceUnavailableError("yhub is down"),
    ]

    with mock.patch.object(delete_service_documents, "retry") as mock_retry:
        result = delete_service_documents.apply(
            args=[["first-id", "second-id", "third-id"]]
        )

    assert result.successful()

    assert mock_service.return_value.delete_ydoc.call_args_list == [
        mock.call("first-id"),
        mock.call("second-id"),
        mock.call("third-id"),
    ]
    mock_retry.assert_called_once_with(args=[["first-id", "third-id"]], countdown=30)


@mock.patch("core.tasks.documents.YHubService")
def test_delete_service_documents_retry_countdown_doubles(mock_service):
    """Each attempt waits twice as long as the one before, up to a ceiling."""
    mock_service.return_value.delete_ydoc.side_effect = ServiceUnavailableError("down")

    with mock.patch.object(delete_service_documents, "retry") as mock_retry:
        result = delete_service_documents.apply(args=[["first-id"]], retries=3)

    assert result.successful()
    mock_retry.assert_called_once_with(args=[["first-id"]], countdown=240)


@mock.patch("core.tasks.documents.YHubService")
def test_delete_service_documents_gives_up_after_the_retries(mock_service, caplog):
    """Once the retries are spent, the ids are logged: nothing else holds them."""
    mock_service.return_value.delete_ydoc.side_effect = ServiceUnavailableError("down")

    with mock.patch.object(
        delete_service_documents, "retry", side_effect=MaxRetriesExceededError()
    ):
        result = delete_service_documents.apply(args=[["first-id", "second-id"]])

    assert result.successful()
    assert (
        "giving up on deleting documents first-id, second-id on the collaboration "
        "server"
    ) in caplog.text


@mock.patch("core.tasks.documents.YHubService")
def test_delete_service_documents_no_retry_when_all_done(mock_service):
    """Nothing to retry when every deletion went through."""
    with mock.patch.object(delete_service_documents, "retry") as mock_retry:
        result = delete_service_documents.apply(args=[["first-id"]])

    assert result.successful()
    mock_service.return_value.delete_ydoc.assert_called_once_with("first-id")
    mock_retry.assert_not_called()
