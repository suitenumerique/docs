"""
Unit tests for the Document model
"""
# pylint: disable=too-many-lines

from operator import itemgetter
from unittest import mock

from django.core.cache import cache
from django.db import transaction

import pytest

from core import factories, models
from core.services.search_indexers import FindDocumentIndexer

pytestmark = pytest.mark.django_db


def reset_batch_indexer_throttle():
    """Reset throttle flag"""
    cache.delete("document-batch-indexer-throttle")


@pytest.fixture(autouse=True)
def reset_throttle():
    """Reset throttle flag before each test"""
    reset_batch_indexer_throttle()
    yield
    reset_batch_indexer_throttle()


@mock.patch.object(FindDocumentIndexer, "push")
@pytest.mark.usefixtures("indexer_settings")
@pytest.mark.django_db(transaction=True)
def test_models_documents_post_save_indexer(mock_push):
    """Test indexation task on document creation"""
    with transaction.atomic():
        doc1, doc2, doc3 = factories.DocumentFactory.create_batch(3)

    accesses = {}
    data = [call.args[0] for call in mock_push.call_args_list]

    indexer = FindDocumentIndexer()

    assert len(data) == 1

    # One call
    assert sorted(data[0], key=itemgetter("id")) == sorted(
        [
            indexer.serialize_document(doc1, accesses),
            indexer.serialize_document(doc2, accesses),
            indexer.serialize_document(doc3, accesses),
        ],
        key=itemgetter("id"),
    )

    # The throttle counters should be reset
    assert cache.get("document-batch-indexer-throttle") == 1


@pytest.mark.django_db(transaction=True)
def test_models_documents_post_save_indexer_no_batches(indexer_settings):
    """Test indexation task on doculment creation, no throttle"""
    indexer_settings.SEARCH_INDEXER_COUNTDOWN = 0

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        with transaction.atomic():
            doc1, doc2, doc3 = factories.DocumentFactory.create_batch(3)

    accesses = {}
    data = [call.args[0] for call in mock_push.call_args_list]

    indexer = FindDocumentIndexer()

    # 3 calls
    assert len(data) == 3
    # one document per call
    assert [len(d) for d in data] == [1] * 3
    # all documents are indexed
    assert sorted([d[0] for d in data], key=itemgetter("id")) == sorted(
        [
            indexer.serialize_document(doc1, accesses),
            indexer.serialize_document(doc2, accesses),
            indexer.serialize_document(doc3, accesses),
        ],
        key=itemgetter("id"),
    )

    # The throttle counters should be reset
    assert cache.get("file-batch-indexer-throttle") is None


@mock.patch.object(FindDocumentIndexer, "push")
@pytest.mark.django_db(transaction=True)
def test_models_documents_post_save_indexer_not_configured(mock_push, indexer_settings):
    """Task should not start an indexation when disabled"""
    indexer_settings.SEARCH_INDEXER_CLASS = None

    user = factories.UserFactory()

    with transaction.atomic():
        doc = factories.DocumentFactory()
        factories.UserDocumentAccessFactory(document=doc, user=user)

    assert mock_push.assert_not_called


@mock.patch.object(FindDocumentIndexer, "push")
@pytest.mark.django_db(transaction=True)
def test_models_documents_post_save_indexer_wrongly_configured(
    mock_push, indexer_settings
):
    """Task should not start an indexation when disabled"""
    indexer_settings.INDEXING_URL = None

    user = factories.UserFactory()

    with transaction.atomic():
        doc = factories.DocumentFactory()
        factories.UserDocumentAccessFactory(document=doc, user=user)

    assert mock_push.assert_not_called


@mock.patch.object(FindDocumentIndexer, "push")
@pytest.mark.usefixtures("indexer_settings")
@pytest.mark.django_db(transaction=True)
def test_models_documents_post_save_indexer_with_accesses(mock_push):
    """Test indexation task on document creation"""
    user = factories.UserFactory()

    with transaction.atomic():
        doc1, doc2, doc3 = factories.DocumentFactory.create_batch(3)

        factories.UserDocumentAccessFactory(document=doc1, user=user)
        factories.UserDocumentAccessFactory(document=doc2, user=user)
        factories.UserDocumentAccessFactory(document=doc3, user=user)

    accesses = {
        str(doc1.path): {"users": [user.sub]},
        str(doc2.path): {"users": [user.sub]},
        str(doc3.path): {"users": [user.sub]},
    }

    data = [call.args[0] for call in mock_push.call_args_list]

    indexer = FindDocumentIndexer()

    assert len(data) == 1
    assert sorted(data[0], key=itemgetter("id")) == sorted(
        [
            indexer.serialize_document(doc1, accesses),
            indexer.serialize_document(doc2, accesses),
            indexer.serialize_document(doc3, accesses),
        ],
        key=itemgetter("id"),
    )


@mock.patch.object(FindDocumentIndexer, "push")
@pytest.mark.usefixtures("indexer_settings")
@pytest.mark.django_db(transaction=True)
def test_models_documents_post_save_indexer_deleted(mock_push):
    """Indexation task on deleted or ancestor_deleted documents"""
    user = factories.UserFactory()

    with transaction.atomic():
        doc = factories.DocumentFactory(
            link_reach=models.LinkReachChoices.AUTHENTICATED
        )
        main_doc = factories.DocumentFactory(
            link_reach=models.LinkReachChoices.AUTHENTICATED
        )
        child_doc = factories.DocumentFactory(
            parent=main_doc,
            link_reach=models.LinkReachChoices.AUTHENTICATED,
        )

        factories.UserDocumentAccessFactory(document=doc, user=user)
        factories.UserDocumentAccessFactory(document=main_doc, user=user)
        factories.UserDocumentAccessFactory(document=child_doc, user=user)

    # Manually reset the throttle flag here or the next indexation will be ignored for 1 second
    reset_batch_indexer_throttle()

    with transaction.atomic():
        main_doc_deleted = models.Document.objects.get(pk=main_doc.pk)
        main_doc_deleted.soft_delete()

    child_doc_deleted = models.Document.objects.get(pk=child_doc.pk)

    main_doc_deleted.refresh_from_db()
    child_doc_deleted.refresh_from_db()

    assert main_doc_deleted.deleted_at is not None
    assert child_doc_deleted.ancestors_deleted_at is not None

    assert child_doc_deleted.deleted_at is None
    assert child_doc_deleted.ancestors_deleted_at is not None

    accesses = {
        str(doc.path): {"users": [user.sub]},
        str(main_doc_deleted.path): {"users": [user.sub]},
        str(child_doc_deleted.path): {"users": [user.sub]},
    }

    data = [call.args[0] for call in mock_push.call_args_list]

    indexer = FindDocumentIndexer()

    assert len(data) == 2

    # First indexation on document creation
    assert sorted(data[0], key=itemgetter("id")) == sorted(
        [
            indexer.serialize_document(doc, accesses),
            indexer.serialize_document(main_doc, accesses),
            indexer.serialize_document(child_doc, accesses),
        ],
        key=itemgetter("id"),
    )

    # Even deleted items are re-indexed : only update their status in the future
    assert sorted(data[1], key=itemgetter("id")) == sorted(
        [
            indexer.serialize_document(main_doc_deleted, accesses),  # soft_delete()
            indexer.serialize_document(child_doc_deleted, accesses),
        ],
        key=itemgetter("id"),
    )


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("indexer_settings")
def test_models_documents_indexer_hard_deleted():
    """Indexation task on hard deleted document"""
    user = factories.UserFactory()

    with transaction.atomic():
        doc = factories.DocumentFactory(
            link_reach=models.LinkReachChoices.AUTHENTICATED
        )
        factories.UserDocumentAccessFactory(document=doc, user=user)

    # Call task on deleted document.
    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        doc.delete()

    # Hard delete document are not re-indexed.
    assert mock_push.assert_not_called


@mock.patch.object(FindDocumentIndexer, "push")
@pytest.mark.usefixtures("indexer_settings")
@pytest.mark.django_db(transaction=True)
def test_models_documents_post_save_indexer_restored(mock_push):
    """Restart indexation task on restored documents"""
    user = factories.UserFactory()

    with transaction.atomic():
        doc = factories.DocumentFactory(
            link_reach=models.LinkReachChoices.AUTHENTICATED
        )
        doc_deleted = factories.DocumentFactory(
            link_reach=models.LinkReachChoices.AUTHENTICATED
        )
        doc_ancestor_deleted = factories.DocumentFactory(
            parent=doc_deleted,
            link_reach=models.LinkReachChoices.AUTHENTICATED,
        )

        factories.UserDocumentAccessFactory(document=doc, user=user)
        factories.UserDocumentAccessFactory(document=doc_deleted, user=user)
        factories.UserDocumentAccessFactory(document=doc_ancestor_deleted, user=user)

        doc_deleted.soft_delete()

    doc_deleted.refresh_from_db()
    doc_ancestor_deleted.refresh_from_db()

    assert doc_deleted.deleted_at is not None
    assert doc_deleted.ancestors_deleted_at is not None

    assert doc_ancestor_deleted.deleted_at is None
    assert doc_ancestor_deleted.ancestors_deleted_at is not None

    # Manually reset the throttle flag here or the next indexation will be ignored for 1 second
    reset_batch_indexer_throttle()

    with transaction.atomic():
        doc_restored = models.Document.objects.get(pk=doc_deleted.pk)
        doc_restored.restore()

    doc_ancestor_restored = models.Document.objects.get(pk=doc_ancestor_deleted.pk)

    assert doc_restored.deleted_at is None
    assert doc_restored.ancestors_deleted_at is None

    assert doc_ancestor_restored.deleted_at is None
    assert doc_ancestor_restored.ancestors_deleted_at is None

    accesses = {
        str(doc.path): {"users": [user.sub]},
        str(doc_deleted.path): {"users": [user.sub]},
        str(doc_ancestor_deleted.path): {"users": [user.sub]},
    }

    data = [call.args[0] for call in mock_push.call_args_list]

    indexer = FindDocumentIndexer()

    # All docs are re-indexed
    assert len(data) == 2

    # First indexation on items creation & soft delete (in the same transaction)
    assert sorted(data[0], key=itemgetter("id")) == sorted(
        [
            indexer.serialize_document(doc, accesses),
            indexer.serialize_document(doc_deleted, accesses),
            indexer.serialize_document(doc_ancestor_deleted, accesses),
        ],
        key=itemgetter("id"),
    )

    # Restored items are re-indexed : only update their status in the future
    assert sorted(data[1], key=itemgetter("id")) == sorted(
        [
            indexer.serialize_document(doc_restored, accesses),  # restore()
            indexer.serialize_document(doc_ancestor_restored, accesses),
        ],
        key=itemgetter("id"),
    )


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("indexer_settings")
def test_models_documents_post_save_indexer_throttle():
    """Test indexation task skipping on document update"""
    indexer = FindDocumentIndexer()
    user = factories.UserFactory()

    with mock.patch.object(FindDocumentIndexer, "push"):
        with transaction.atomic():
            docs = factories.DocumentFactory.create_batch(5, users=(user,))

    accesses = {str(item.path): {"users": [user.sub]} for item in docs}

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        # Simulate 1 running task
        cache.set("document-batch-indexer-throttle", 1)

        # save doc to trigger the indexer, but nothing should be done since
        # the flag is up
        with transaction.atomic():
            docs[0].save()
            docs[2].save()
            docs[3].save()

        assert [call.args[0] for call in mock_push.call_args_list] == []

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        # No waiting task
        cache.delete("document-batch-indexer-throttle")

        with transaction.atomic():
            docs[0].save()
            docs[2].save()
            docs[3].save()

        data = [call.args[0] for call in mock_push.call_args_list]

        # One call
        assert len(data) == 1

        assert sorted(data[0], key=itemgetter("id")) == sorted(
            [
                indexer.serialize_document(docs[0], accesses),
                indexer.serialize_document(docs[2], accesses),
                indexer.serialize_document(docs[3], accesses),
            ],
            key=itemgetter("id"),
        )


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("indexer_settings")
def test_models_documents_access_post_save_indexer():
    """Test indexation task on DocumentAccess update"""
    users = factories.UserFactory.create_batch(3)

    with mock.patch.object(FindDocumentIndexer, "push"):
        with transaction.atomic():
            doc = factories.DocumentFactory(users=users)
            doc_accesses = models.DocumentAccess.objects.filter(document=doc).order_by(
                "user__sub"
            )

    reset_batch_indexer_throttle()

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        with transaction.atomic():
            for doc_access in doc_accesses:
                doc_access.save()

        data = [call.args[0] for call in mock_push.call_args_list]

        # One call
        assert len(data) == 1

        assert [d["id"] for d in data[0]] == [str(doc.pk)]


@pytest.mark.django_db(transaction=True)
def test_models_items_access_post_save_indexer_no_throttle(indexer_settings):
    """Test indexation task on ItemAccess update, no throttle"""
    indexer_settings.SEARCH_INDEXER_COUNTDOWN = 0

    users = factories.UserFactory.create_batch(3)

    with transaction.atomic():
        doc = factories.DocumentFactory(users=users)
        doc_accesses = models.DocumentAccess.objects.filter(document=doc).order_by(
            "user__sub"
        )

    reset_batch_indexer_throttle()

    with mock.patch.object(FindDocumentIndexer, "push") as mock_push:
        with transaction.atomic():
            for doc_access in doc_accesses:
                doc_access.save()

        data = [call.args[0] for call in mock_push.call_args_list]

        # 3 calls
        assert len(data) == 3
        # one document per call
        assert [len(d) for d in data] == [1] * 3
        # the same document is indexed 3 times
        assert [d[0]["id"] for d in data] == [str(doc.pk)] * 3
