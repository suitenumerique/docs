"""
Tests of the answers of Find to the batches of documents FindDocumentIndexer pushes
"""

import json
import logging
from json import dumps as json_dumps

import pytest
import responses
from requests import HTTPError
from responses.registries import OrderedRegistry

from core import factories
from core.services.search_indexers import FindDocumentIndexer

pytestmark = pytest.mark.django_db

INDEX_URL = "http://app-find/api/v1.0/documents/index/"
VALIDATION_ERROR = {
    "msg": "String should have at most 50 characters",
    "type": "string_too_long",
    "loc": ["users", 0],
}


def batch_of(size):
    """A batch of serialized documents, as push receives it."""
    return [{"id": f"doc-{i}", "title": f"title {i}"} for i in range(size)]


def sent_ids(call):
    """Ids of the documents of a request sent to Find."""
    return [document["id"] for document in json.loads(call.request.body)]


@responses.activate
def test_services_search_indexers_push_all_indexed(indexer_settings):
    """A batch Find indexed entirely should be counted entirely."""
    indexer_settings.INDEXING_URL = INDEX_URL
    responses.add(
        responses.POST,
        INDEX_URL,
        status=201,
        json=[{"index": i, "status": "success", "_id": f"doc-{i}"} for i in range(3)],
    )

    assert FindDocumentIndexer().push(batch_of(3)) == 3
    assert len(responses.calls) == 1


@responses.activate
def test_services_search_indexers_push_some_not_indexed(indexer_settings, caplog):
    """
    On a 207, the documents Find could not index should be logged and not counted,
    the others are indexed.
    """
    indexer_settings.INDEXING_URL = INDEX_URL
    responses.add(
        responses.POST,
        INDEX_URL,
        status=207,
        json=[
            {"index": 0, "status": "success", "_id": "doc-0"},
            {
                "index": 1,
                "status": "error",
                "_id": "doc-1",
                "message": "failed to parse field [created_at] " + "x" * 300,
            },
            {"index": 2, "status": "success", "_id": "doc-2"},
        ],
    )

    with caplog.at_level(logging.ERROR, logger="core.services.search_indexers"):
        assert FindDocumentIndexer().push(batch_of(3)) == 2

    assert len(responses.calls) == 1
    assert "Document doc-1 was not indexed by Find, it could not be indexed" in (
        caplog.text
    )
    assert "failed to parse field [created_at]" in caplog.text
    # The reason of OpenSearch is cut: it can quote the value of a field
    assert "x" * 201 not in caplog.text
    assert "doc-0" not in caplog.text


def test_services_search_indexers_push_invalid_documents_left_out(
    indexer_settings, caplog
):
    """
    On a 400, Find indexed nothing: the documents that failed validation should be
    logged, and the batch sent again without them.
    """
    indexer_settings.INDEXING_URL = INDEX_URL

    with responses.RequestsMock(registry=OrderedRegistry) as find:
        find.add(
            responses.POST,
            INDEX_URL,
            status=400,
            json=[
                {"index": 0, "status": "valid", "_id": "doc-0"},
                {"index": 1, "status": "error", "errors": [VALIDATION_ERROR]},
                {"index": 2, "status": "valid", "_id": "doc-2"},
            ],
        )
        find.add(
            responses.POST,
            INDEX_URL,
            status=201,
            json=[{"index": i, "status": "success"} for i in range(2)],
        )

        with caplog.at_level(logging.ERROR, logger="core.services.search_indexers"):
            assert FindDocumentIndexer().push(batch_of(3)) == 2

        assert [sent_ids(call) for call in find.calls] == [
            ["doc-0", "doc-1", "doc-2"],
            ["doc-0", "doc-2"],
        ]

    assert (
        "Document doc-1 was not indexed by Find, it failed validation: "
        "users.0: String should have at most 50 characters"
    ) in caplog.text


@responses.activate
def test_services_search_indexers_push_all_invalid(indexer_settings, caplog):
    """A batch with only invalid documents should not be sent again."""
    indexer_settings.INDEXING_URL = INDEX_URL
    responses.add(
        responses.POST,
        INDEX_URL,
        status=400,
        json=[
            {"index": i, "status": "error", "errors": [VALIDATION_ERROR]}
            for i in range(2)
        ],
    )

    with caplog.at_level(logging.ERROR, logger="core.services.search_indexers"):
        assert FindDocumentIndexer().push(batch_of(2)) == 0

    assert len(responses.calls) == 1
    assert "doc-0" in caplog.text
    assert "doc-1" in caplog.text


def test_services_search_indexers_push_refused_again(indexer_settings):
    """A batch refused again once the invalid documents are left out is raised."""
    indexer_settings.INDEXING_URL = INDEX_URL

    with responses.RequestsMock(registry=OrderedRegistry) as find:
        for _ in range(2):
            find.add(
                responses.POST,
                INDEX_URL,
                status=400,
                json=[
                    {"index": 0, "status": "valid"},
                    {"index": 1, "status": "error", "errors": [VALIDATION_ERROR]},
                ],
            )

        with pytest.raises(HTTPError):
            FindDocumentIndexer().push(batch_of(2))

        assert len(find.calls) == 2


@pytest.mark.parametrize(
    "body",
    [
        {"detail": "Invalid request."},
        [{"msg": "Field required", "type": "missing", "loc": ["id"]}],
        [{"index": 5, "status": "error"}],
        "not json",
    ],
)
@responses.activate
def test_services_search_indexers_push_refused_without_statuses(body, indexer_settings):
    """A 400 that does not give a status per document is raised, nothing resent."""
    indexer_settings.INDEXING_URL = INDEX_URL
    if isinstance(body, str):
        responses.add(responses.POST, INDEX_URL, status=400, body=body)
    else:
        responses.add(responses.POST, INDEX_URL, status=400, json=body)

    with pytest.raises(HTTPError):
        FindDocumentIndexer().push(batch_of(2))

    assert len(responses.calls) == 1


def find_validation(request):
    """Answer an indexing request as Find does for the length of the users."""
    documents = json.loads(request.body)
    invalid = {
        i
        for i, document in enumerate(documents)
        if any(len(user) > 50 for user in document["users"])
    }
    if invalid:
        results = [
            {"index": i, "status": "error", "errors": [VALIDATION_ERROR]}
            if i in invalid
            else {"index": i, "status": "valid", "_id": document["id"]}
            for i, document in enumerate(documents)
        ]
        return 400, {}, json_dumps(results)
    results = [
        {"index": i, "status": "success", "_id": document["id"]}
        for i, document in enumerate(documents)
    ]
    return 201, {}, json_dumps(results)


@responses.activate
def test_services_search_indexers_index_despite_an_invalid_document(
    indexer_settings, caplog
):
    """
    A document Find refuses (here, shared with a user whose sub is longer than Find
    accepts) should not keep the other documents of its batch, nor the next
    batches, from being indexed.
    """
    indexer_settings.INDEXING_URL = INDEX_URL
    responses.add_callback(responses.POST, INDEX_URL, callback=find_validation)
    documents = factories.DocumentFactory.create_batch(5)
    long_sub_user = factories.UserFactory(sub="s" * 60)
    factories.UserDocumentAccessFactory(document=documents[1], user=long_sub_user)

    with caplog.at_level(logging.ERROR, logger="core.services.search_indexers"):
        assert FindDocumentIndexer().index(batch_size=2) == 4

    indexed = [
        sent_ids(call) for call in responses.calls if call.response.status_code == 201
    ]
    assert sorted(sum(indexed, [])) == sorted(
        str(document.id) for i, document in enumerate(documents) if i != 1
    )
    assert f"Document {documents[1].id} was not indexed by Find" in caplog.text
