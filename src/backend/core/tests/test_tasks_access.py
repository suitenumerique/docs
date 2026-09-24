"""
Tests for the `reset_service_connections_in_cascade` Celery task in the
core.tasks.access module.
"""

from unittest import mock
from uuid import uuid4

from django.db import transaction

import pytest

from core import factories
from core.services.yhub_services import ServiceUnavailableError
from core.tasks.access import (
    reset_service_connections_in_cascade,
    reset_service_connections_on_commit,
)

pytestmark = pytest.mark.django_db


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_resets_the_document(mock_service):
    """The task should reset the connections of the document it is given."""
    document = factories.DocumentFactory()

    reset_service_connections_in_cascade(str(document.id))

    mock_service.return_value.reset_connections.assert_called_once_with(document, None)


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_forwards_the_user_id(mock_service):
    """The user whose access changed should be forwarded to the service."""
    document = factories.DocumentFactory()

    reset_service_connections_in_cascade(str(document.id), "user-id")

    mock_service.return_value.reset_connections.assert_called_once_with(
        document, "user-id"
    )


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_in_cascade(mock_service):
    """
    A document inherits the accesses of its ancestors, so the whole subtree
    should be reset, the document itself included and its ancestors left out.
    """
    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)
    child = factories.DocumentFactory(parent=document)
    grand_child = factories.DocumentFactory(parent=child)
    factories.DocumentFactory()  # a document of another tree

    reset_service_connections_in_cascade(str(document.id))

    assert mock_service.return_value.reset_connections.call_args_list == [
        mock.call(document, None),
        mock.call(child, None),
        mock.call(grand_child, None),
    ]


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_unknown_document(mock_service):
    """A document deleted in the meantime should not reach the service."""
    reset_service_connections_in_cascade("d43ea3c5-b8ee-4a4a-9c60-2ad7a1d9e6cf")

    mock_service.return_value.reset_connections.assert_not_called()


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_keeps_going_on_failure(mock_service):
    """A document failing should not deprive the ones after it of their reset."""
    document = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=document)
    mock_service.return_value.reset_connections.side_effect = [
        ServiceUnavailableError("yhub is down"),
        None,
    ]

    reset_service_connections_in_cascade(str(document.id))

    assert mock_service.return_value.reset_connections.call_args_list == [
        mock.call(document, None),
        mock.call(child, None),
    ]


def test_reset_service_connections_on_commit(
    mock_reset_service_connections, django_capture_on_commit_callbacks
):
    """The reset should be queued once the transaction is committed, ids as strings."""
    document_id, user_id = uuid4(), uuid4()

    with django_capture_on_commit_callbacks(execute=True):
        reset_service_connections_on_commit(document_id, user_id)
        mock_reset_service_connections.assert_not_called()

    mock_reset_service_connections.assert_called_once_with(
        str(document_id), str(user_id)
    )


def test_reset_service_connections_on_commit_without_user(
    mock_reset_service_connections, django_capture_on_commit_callbacks
):
    """Naming nobody re-checks every connection."""
    document_id = uuid4()

    with django_capture_on_commit_callbacks(execute=True):
        reset_service_connections_on_commit(document_id)

    mock_reset_service_connections.assert_called_once_with(str(document_id), None)


def test_reset_service_connections_on_commit_coalesces_users(
    mock_reset_service_connections, django_capture_on_commit_callbacks
):
    """Asking twice for the same user in one transaction queues one task."""
    document_id, user_id, other_user_id = uuid4(), uuid4(), uuid4()

    with django_capture_on_commit_callbacks(execute=True):
        reset_service_connections_on_commit(document_id, user_id)
        reset_service_connections_on_commit(document_id, user_id)
        reset_service_connections_on_commit(document_id, other_user_id)

    assert sorted(mock_reset_service_connections.call_args_list, key=str) == sorted(
        [
            mock.call(str(document_id), str(user_id)),
            mock.call(str(document_id), str(other_user_id)),
        ],
        key=str,
    )


def test_reset_service_connections_on_commit_everybody_covers_the_users(
    mock_reset_service_connections, django_capture_on_commit_callbacks
):
    """A document asked for everybody is reset once, whatever else was asked."""
    document_id, user_id = uuid4(), uuid4()

    with django_capture_on_commit_callbacks(execute=True):
        reset_service_connections_on_commit(document_id, user_id)
        reset_service_connections_on_commit(document_id)
        reset_service_connections_on_commit(document_id, uuid4())

    mock_reset_service_connections.assert_called_once_with(str(document_id), None)


def test_reset_service_connections_on_commit_keeps_documents_apart(
    mock_reset_service_connections, django_capture_on_commit_callbacks
):
    """Coalescing is per document."""
    document_id, other_document_id, user_id = uuid4(), uuid4(), uuid4()

    with django_capture_on_commit_callbacks(execute=True):
        reset_service_connections_on_commit(document_id)
        reset_service_connections_on_commit(other_document_id, user_id)

    assert sorted(mock_reset_service_connections.call_args_list, key=str) == sorted(
        [
            mock.call(str(document_id), None),
            mock.call(str(other_document_id), str(user_id)),
        ],
        key=str,
    )


def test_reset_service_connections_on_commit_new_batch_after_a_commit(
    mock_reset_service_connections, django_capture_on_commit_callbacks
):
    """Once flushed, the next ask starts a new batch of its own."""
    document_id, user_id = uuid4(), uuid4()

    with django_capture_on_commit_callbacks(execute=True):
        reset_service_connections_on_commit(document_id, user_id)
    with django_capture_on_commit_callbacks(execute=True):
        reset_service_connections_on_commit(document_id, user_id)

    assert mock_reset_service_connections.call_args_list == [
        mock.call(str(document_id), str(user_id)),
        mock.call(str(document_id), str(user_id)),
    ]


def test_reset_service_connections_on_commit_drops_what_was_rolled_back(
    mock_reset_service_connections, django_capture_on_commit_callbacks
):
    """The resets of a rolled back transaction are neither sent nor kept."""
    document_id, other_document_id = uuid4(), uuid4()

    with django_capture_on_commit_callbacks(execute=True):
        with pytest.raises(RuntimeError), transaction.atomic():
            reset_service_connections_on_commit(document_id)
            raise RuntimeError("rolled back")
        reset_service_connections_on_commit(other_document_id)

    mock_reset_service_connections.assert_called_once_with(str(other_document_id), None)


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_paces_the_walk(mock_service, settings):
    """
    A run resets a batch of documents and queues the rest, after a delay and
    from the last path it reached.
    """
    settings.YHUB_RESET_CONNECTIONS_BATCH_SIZE = 2
    settings.YHUB_RESET_CONNECTIONS_DELAY = 3.5
    document = factories.DocumentFactory()
    children = factories.DocumentFactory.create_batch(2, parent=document)
    grand_child = factories.DocumentFactory(parent=children[1])

    with mock.patch.object(
        reset_service_connections_in_cascade, "apply_async"
    ) as mock_apply:
        reset_service_connections_in_cascade(str(document.id), "user-id")

    assert mock_service.return_value.reset_connections.call_args_list == [
        mock.call(document, "user-id"),
        mock.call(children[0], "user-id"),
    ]
    mock_apply.assert_called_once_with(
        args=[str(document.id), "user-id", children[0].path], countdown=3.5
    )

    # the next run carries on from there
    mock_service.reset_mock()
    with mock.patch.object(
        reset_service_connections_in_cascade, "apply_async"
    ) as mock_apply:
        reset_service_connections_in_cascade(
            str(document.id), "user-id", children[0].path
        )

    assert mock_service.return_value.reset_connections.call_args_list == [
        mock.call(children[1], "user-id"),
        mock.call(grand_child, "user-id"),
    ]
    mock_apply.assert_not_called()


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_whole_batch_queues_nothing(mock_service, settings):
    """A subtree fitting in one batch is done in one run."""
    settings.YHUB_RESET_CONNECTIONS_BATCH_SIZE = 2
    document = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=document)

    with mock.patch.object(
        reset_service_connections_in_cascade, "apply_async"
    ) as mock_apply:
        reset_service_connections_in_cascade(str(document.id))

    assert mock_service.return_value.reset_connections.call_args_list == [
        mock.call(document, None),
        mock.call(child, None),
    ]
    mock_apply.assert_not_called()


@mock.patch("core.tasks.access.YHubService")
def test_reset_service_connections_paced_walk_covers_the_subtree(
    mock_service, settings
):
    """Run to the end (eagerly here), the walk resets every document once, in order."""
    settings.YHUB_RESET_CONNECTIONS_BATCH_SIZE = 2
    document = factories.DocumentFactory()
    children = factories.DocumentFactory.create_batch(3, parent=document)
    grand_child = factories.DocumentFactory(parent=children[0])
    factories.DocumentFactory()  # a document of another tree

    reset_service_connections_in_cascade(str(document.id))

    assert mock_service.return_value.reset_connections.call_args_list == [
        mock.call(document, None),
        mock.call(grand_child.get_parent(), None),
        mock.call(grand_child, None),
        mock.call(children[1], None),
        mock.call(children[2], None),
    ]
