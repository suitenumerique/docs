"""
Unit test for `index` command.
"""

import logging
from datetime import datetime, timedelta, timezone
from operator import itemgetter
from unittest import mock

from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.db import transaction

import pytest

from core import factories
from core.factories import DocumentFactory
from core.services.search_indexers import FindDocumentIndexer


@pytest.mark.django_db
@pytest.mark.usefixtures("indexer_settings")
def test_index_without_bound_success():
    """Test the command `index` that run the Find app indexer for all the available documents."""
    user = factories.UserFactory()
    indexer = FindDocumentIndexer()

    with transaction.atomic():
        doc = factories.DocumentFactory()
        empty_doc = factories.DocumentFactory(title=None, content="")
        no_title_doc = factories.DocumentFactory(title=None)

        factories.UserDocumentAccessFactory(document=doc, user=user)
        factories.UserDocumentAccessFactory(document=empty_doc, user=user)
        factories.UserDocumentAccessFactory(document=no_title_doc, user=user)

    accesses = {
        str(doc.path): {"users": [user.sub]},
        str(empty_doc.path): {"users": [user.sub]},
        str(no_title_doc.path): {"users": [user.sub]},
    }

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        call_command("index")

    push_call_args = [call.args[0] for call in mock_push.call_args_list]

    # called once but with a batch of docs
    mock_push.assert_called_once()

    assert sorted(push_call_args[0], key=itemgetter("id")) == sorted(
        [
            indexer.serialize_document(doc, accesses),
            indexer.serialize_document(no_title_doc, accesses),
        ],
        key=itemgetter("id"),
    )


@pytest.mark.django_db
@pytest.mark.usefixtures("indexer_settings")
def test_index_with_both_bounds_success():
    """Test the command `index` for all documents within time bound."""
    cache.clear()
    lower_time_bound = datetime(2024, 2, 1, tzinfo=timezone.utc)
    upper_time_bound = lower_time_bound + timedelta(days=30)

    document_too_early = DocumentFactory(
        updated_at=lower_time_bound - timedelta(days=10)
    )
    document_in_window_1 = DocumentFactory(
        updated_at=lower_time_bound + timedelta(days=5)
    )
    document_in_window_2 = DocumentFactory(
        updated_at=lower_time_bound + timedelta(days=15)
    )
    document_too_late = DocumentFactory(
        updated_at=upper_time_bound + timedelta(days=10)
    )

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        call_command(
            "index",
            lower_time_bound=lower_time_bound.isoformat(),
            upper_time_bound=upper_time_bound.isoformat(),
        )
    pushed_document_ids = [
        document["id"]
        for call_arg_list in mock_push.call_args_list
        for document in call_arg_list.args[0]
    ]

    # Only documents in window should be indexed
    assert str(document_too_early.id) not in pushed_document_ids
    assert str(document_in_window_1.id) in pushed_document_ids
    assert str(document_in_window_2.id) in pushed_document_ids
    assert str(document_too_late.id) not in pushed_document_ids


@pytest.mark.django_db
@pytest.mark.usefixtures("indexer_settings")
def test_index_with_crash_recovery(caplog_with_propagate):
    """Test resuming indexing from checkpoint after a crash."""
    cache.clear()
    lower_time_bound = datetime(2024, 2, 1, tzinfo=timezone.utc)
    upper_time_bound = lower_time_bound + timedelta(days=60)

    batch_size = 2
    documents = [
        # batch 0
        factories.DocumentFactory(updated_at=lower_time_bound + timedelta(days=5)),
        factories.DocumentFactory(updated_at=lower_time_bound + timedelta(days=10)),
        # batch 1
        factories.DocumentFactory(updated_at=lower_time_bound + timedelta(days=20)),
        factories.DocumentFactory(updated_at=lower_time_bound + timedelta(days=25)),
        # batch 2 - will crash here
        factories.DocumentFactory(updated_at=lower_time_bound + timedelta(days=30)),
        factories.DocumentFactory(updated_at=lower_time_bound + timedelta(days=35)),
        # batch 3
        factories.DocumentFactory(updated_at=lower_time_bound + timedelta(days=40)),
        factories.DocumentFactory(updated_at=lower_time_bound + timedelta(days=45)),
    ]

    def push_with_failure_on_batch_2(data):
        # Crash when encounters document at index 4 (batch 2 with batch_size=2)
        if str(documents[4].id) in [document["id"] for document in data]:
            raise ConnectionError("Simulated indexing error")

    # First run: simulate crash on batch 3
    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        mock_push.side_effect = push_with_failure_on_batch_2
        with pytest.raises(CommandError):
            with caplog_with_propagate.at_level(logging.INFO):
                call_command(
                    "index",
                    batch_size=batch_size,
                    lower_time_bound=lower_time_bound.isoformat(),
                    upper_time_bound=upper_time_bound.isoformat(),
                )
    pushed_document_ids = [
        document["id"]
        for call_arg_list in mock_push.call_args_list
        for document in call_arg_list.args[0]
    ]

    # the updated at of the last document of each batch are logged as checkpoint
    # -> documents[3].updated_at is the most advanced checkpoint
    for i in [1, 3]:
        assert any(
            f"Indexing checkpoint: {documents[i].updated_at.isoformat()}." in message
            for message in caplog_with_propagate.messages
        )
    for i in [0, 2, 4, 5, 6]:
        assert not any(
            f"Indexing checkpoint: {documents[i].updated_at.isoformat()}" in message
            for message in caplog_with_propagate.messages
        )
    # first 2 batches should be indexed successfully
    for i in range(0, 4):
        assert str(documents[i].id) in pushed_document_ids
    # next batch should have been attempted but failed
    for i in range(4, 6):
        assert str(documents[i].id) in pushed_document_ids
    # last batches indexing should not have been attempted
    for i in range(6, 8):
        assert str(documents[i].id) not in pushed_document_ids

    # Second run: resume from checkpoint
    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        call_command(
            "index",
            batch_size=batch_size,
            lower_time_bound=documents[3].updated_at,
            upper_time_bound=upper_time_bound.isoformat(),
        )
    pushed_document_ids = [
        document["id"]
        for call_arg_list in mock_push.call_args_list
        for document in call_arg_list.args[0]
    ]

    # first 2 batches should NOT be re-indexed
    # except the last document of the last batch which is on the checkpoint boundary
    # -> doc 0, 1 and 2
    for i in range(0, 3):
        assert str(documents[i].id) not in pushed_document_ids
    # next batches should be indexed including the document at the checkpoint boundary
    # which has already been indexed and is re-indexed
    # -> doc 3 to the end
    for i in range(3, 8):
        assert str(documents[i].id) in pushed_document_ids


@pytest.mark.django_db
@pytest.mark.usefixtures("indexer_settings")
def test_index_improperly_configured(indexer_settings):
    """The command should raise an exception if the indexer is not configured"""
    indexer_settings.SEARCH_INDEXER_CLASS = None

    with pytest.raises(CommandError) as err:
        call_command("index")

    assert str(err.value) == "The indexer is not enabled or properly configured."


@pytest.mark.django_db
@pytest.mark.usefixtures("indexer_settings")
def test_index_with_async_flag(settings):
    """Test the command `index` with --async=True runs task asynchronously."""
    cache.clear()
    lower_time_bound = datetime(2024, 2, 1, tzinfo=timezone.utc)

    with mock.patch(
        "core.management.commands.index.batch_document_indexer_task"
    ) as mock_task:
        with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
            call_command(
                "index", async_mode=True, lower_time_bound=lower_time_bound.isoformat()
            )
    # push not be called synchronously
    mock_push.assert_not_called()
    # task called asynchronously
    mock_task.apply_async.assert_called_once_with(
        kwargs={
            "lower_time_bound": lower_time_bound.isoformat(),
            "upper_time_bound": None,
            "batch_size": settings.SEARCH_INDEXER_BATCH_SIZE,
            "crash_safe_mode": True,
        }
    )


@pytest.mark.django_db
@pytest.mark.usefixtures("indexer_settings")
def test_index_without_async_flag():
    """Test the command `index` with --async=False runs synchronously."""
    cache.clear()
    lower_time_bound = datetime(2024, 2, 1, tzinfo=timezone.utc)

    document = DocumentFactory(updated_at=lower_time_bound + timedelta(days=10))

    with mock.patch(
        "core.management.commands.index.batch_document_indexer_task"
    ) as mock_task:
        with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
            call_command(
                "index", async_mode=False, lower_time_bound=lower_time_bound.isoformat()
            )
    # push is called synchronously to index the document
    pushed_document_ids = [
        document["id"]
        for call_arg_list in mock_push.call_args_list
        for document in call_arg_list.args[0]
    ]
    assert str(document.id) in pushed_document_ids
    # async task not called
    mock_task.apply_async.assert_not_called()
