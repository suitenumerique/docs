"""Tests for the tasks indexing documents."""

from unittest import mock
from uuid import uuid4

import pytest

from core import factories
from core.services.search_indexers import FindDocumentIndexer
from core.tasks.search import (
    subtree_document_indexer_task,
    trigger_subtree_document_indexer,
)

pytestmark = pytest.mark.django_db


@mock.patch.object(FindDocumentIndexer, "push")
@pytest.mark.usefixtures("indexer_settings")
def test_tasks_search_subtree_document_indexer_task(mock_push):
    """
    The documents and their descendants should be indexed, whatever their last
    update, and nothing else.
    """
    root = factories.DocumentFactory()
    child = factories.DocumentFactory(parent=root)
    grandchild = factories.DocumentFactory(parent=child)
    other = factories.DocumentFactory()
    other_child = factories.DocumentFactory(parent=other)
    factories.DocumentFactory()

    subtree_document_indexer_task([str(root.pk), str(child.pk), str(other_child.pk)])

    indexed = [doc["id"] for call in mock_push.call_args_list for doc in call.args[0]]
    assert sorted(indexed) == sorted(
        str(document.pk) for document in (root, child, grandchild, other_child)
    )


@mock.patch.object(FindDocumentIndexer, "push")
@pytest.mark.usefixtures("indexer_settings")
def test_tasks_search_subtree_document_indexer_task_unknown(mock_push):
    """Documents deleted for good in the meantime should index nothing."""
    factories.DocumentFactory()

    subtree_document_indexer_task([str(uuid4())])

    mock_push.assert_not_called()


@mock.patch("core.tasks.search.subtree_document_indexer_task.delay")
@pytest.mark.usefixtures("indexer_settings")
def test_tasks_search_trigger_subtree_document_indexer(
    mock_delay, django_capture_on_commit_callbacks
):
    """The task should be queued once the transaction is committed, without debounce."""
    documents = factories.DocumentFactory.create_batch(2)

    with django_capture_on_commit_callbacks() as callbacks:
        trigger_subtree_document_indexer(document.pk for document in documents)
        trigger_subtree_document_indexer([documents[0].pk])
    mock_delay.assert_not_called()

    for callback in callbacks:
        callback()
    assert mock_delay.call_args_list == [
        mock.call([str(document.pk) for document in documents]),
        mock.call([str(documents[0].pk)]),
    ]


@mock.patch("core.tasks.search.subtree_document_indexer_task.delay")
def test_tasks_search_trigger_subtree_document_indexer_disabled(
    mock_delay, settings, django_capture_on_commit_callbacks
):
    """No task should be queued when the indexation is disabled, or for no document."""
    document = factories.DocumentFactory()
    settings.SEARCH_INDEXER_CLASS = None

    with django_capture_on_commit_callbacks(execute=True):
        trigger_subtree_document_indexer([document.pk])

    settings.SEARCH_INDEXER_CLASS = "core.services.search_indexers.FindDocumentIndexer"
    with django_capture_on_commit_callbacks(execute=True):
        trigger_subtree_document_indexer([])

    mock_delay.assert_not_called()
