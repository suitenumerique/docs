"""Tests for Documents search indexers"""

from functools import partial
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser

import pytest

from core import factories, models, utils
from core.services.search_indexers import (
    FindDocumentIndexer,
    get_visited_document_ids_of,
)

pytestmark = pytest.mark.django_db


def test_push_raises_error_if_search_indexer_url_is_none(settings):
    """
    Indexer should raise RuntimeError if SEARCH_INDEXER_URL is None or empty.
    """
    settings.SEARCH_INDEXER_URL = None
    indexer = FindDocumentIndexer()

    with pytest.raises(RuntimeError) as exc_info:
        indexer.push([])

    assert "SEARCH_INDEXER_URL must be set in Django settings before indexing." in str(
        exc_info.value
    )


def test_push_raises_error_if_search_indexer_url_is_empty(settings):
    """
    Indexer should raise RuntimeError if SEARCH_INDEXER_URL is empty string.
    """
    settings.SEARCH_INDEXER_URL = ""
    indexer = FindDocumentIndexer()

    with pytest.raises(RuntimeError) as exc_info:
        indexer.push([])

    assert "SEARCH_INDEXER_URL must be set in Django settings before indexing." in str(
        exc_info.value
    )


def test_push_raises_error_if_search_indexer_secret_is_none(settings):
    """
    Indexer should raise RuntimeError if SEARCH_INDEXER_SECRET is None or empty.
    """
    settings.SEARCH_INDEXER_SECRET = None
    indexer = FindDocumentIndexer()

    with pytest.raises(RuntimeError) as exc_info:
        indexer.push([])

    assert (
        "SEARCH_INDEXER_SECRET must be set in Django settings before indexing."
        in str(exc_info.value)
    )


def test_push_raises_error_if_search_indexer_secret_is_empty(settings):
    """
    Indexer should raise RuntimeError if SEARCH_INDEXER_SECRET is empty string.
    """
    settings.SEARCH_INDEXER_SECRET = ""
    indexer = FindDocumentIndexer()

    with pytest.raises(RuntimeError) as exc_info:
        indexer.push([])

    assert (
        "SEARCH_INDEXER_SECRET must be set in Django settings before indexing."
        in str(exc_info.value)
    )


def test_services_search_indexers_serialize_document_returns_expected_json():
    """
    It should serialize documents with correct metadata and access control.
    """
    user_a, user_b = factories.UserFactory.create_batch(2)
    document = factories.DocumentFactory()
    factories.DocumentFactory(parent=document)

    factories.UserDocumentAccessFactory(document=document, user=user_a)
    factories.UserDocumentAccessFactory(document=document, user=user_b)
    factories.TeamDocumentAccessFactory(document=document, team="team1")
    factories.TeamDocumentAccessFactory(document=document, team="team2")

    accesses = {
        document.path: {
            "users": {str(user_a.sub), str(user_b.sub)},
            "teams": {"team1", "team2"},
        }
    }

    indexer = FindDocumentIndexer()
    result = indexer.serialize_document(document, accesses)

    assert set(result.pop("users")) == {str(user_a.sub), str(user_b.sub)}
    assert set(result.pop("groups")) == {"team1", "team2"}
    assert result == {
        "id": str(document.id),
        "title": document.title,
        "depth": 1,
        "path": document.path,
        "numchild": 1,
        "content": utils.base64_yjs_to_text(document.content),
        "created_at": document.created_at.isoformat(),
        "updated_at": document.updated_at.isoformat(),
        "reach": document.link_reach,
        "size": 13,
        "is_active": True,
    }


def test_services_search_indexers_serialize_document_deleted():
    """Deleted documents are marked as just in the serialized json."""
    parent = factories.DocumentFactory()
    document = factories.DocumentFactory(parent=parent)

    parent.soft_delete()
    document.refresh_from_db()

    indexer = FindDocumentIndexer()
    result = indexer.serialize_document(document, {})

    assert result["is_active"] is False


def test_services_search_indexers_serialize_document_empty():
    """Empty documents returns empty content in the serialized json."""
    document = factories.DocumentFactory(content="", title=None)

    indexer = FindDocumentIndexer()
    result = indexer.serialize_document(document, {})

    assert result["content"] == ""
    assert result["title"] == ""


@patch.object(FindDocumentIndexer, "push")
def test_services_search_indexers_batches_pass_only_batch_accesses(mock_push, settings):
    """
    Documents indexing should be processed in batches,
    and only the access data relevant to each batch should be used.
    """
    settings.SEARCH_INDEXER_BATCH_SIZE = 2
    documents = factories.DocumentFactory.create_batch(5)

    # Attach a single user access to each document
    expected_user_subs = {}
    for document in documents:
        access = factories.UserDocumentAccessFactory(document=document)
        expected_user_subs[str(document.id)] = str(access.user.sub)

    FindDocumentIndexer().index()

    # Should be 3 batches: 2 + 2 + 1
    assert mock_push.call_count == 3

    seen_doc_ids = set()

    for call in mock_push.call_args_list:
        batch = call.args[0]
        assert isinstance(batch, list)

        for doc_json in batch:
            doc_id = doc_json["id"]
            seen_doc_ids.add(doc_id)

            # Only one user expected per document
            assert doc_json["users"] == [expected_user_subs[doc_id]]
            assert doc_json["groups"] == []

    # Make sure all 5 documents were indexed
    assert seen_doc_ids == {str(d.id) for d in documents}


@patch.object(FindDocumentIndexer, "push")
def test_services_search_indexers_ancestors_link_reach(mock_push):
    """Document accesses and reach should take into account ancestors link reaches."""
    great_grand_parent = factories.DocumentFactory(link_reach="restricted")
    grand_parent = factories.DocumentFactory(
        parent=great_grand_parent, link_reach="authenticated"
    )
    parent = factories.DocumentFactory(parent=grand_parent, link_reach="public")
    document = factories.DocumentFactory(parent=parent, link_reach="restricted")

    FindDocumentIndexer().index()

    results = {doc["id"]: doc for doc in mock_push.call_args[0][0]}
    assert len(results) == 4
    assert results[str(great_grand_parent.id)]["reach"] == "restricted"
    assert results[str(grand_parent.id)]["reach"] == "authenticated"
    assert results[str(parent.id)]["reach"] == "public"
    assert results[str(document.id)]["reach"] == "public"


@patch.object(FindDocumentIndexer, "push")
def test_services_search_indexers_ancestors_users(mock_push):
    """Document accesses and reach should include users from ancestors."""
    user_gp, user_p, user_d = factories.UserFactory.create_batch(3)

    grand_parent = factories.DocumentFactory(users=[user_gp])
    parent = factories.DocumentFactory(parent=grand_parent, users=[user_p])
    document = factories.DocumentFactory(parent=parent, users=[user_d])

    FindDocumentIndexer().index()

    results = {doc["id"]: doc for doc in mock_push.call_args[0][0]}
    assert len(results) == 3
    assert results[str(grand_parent.id)]["users"] == [str(user_gp.sub)]
    assert set(results[str(parent.id)]["users"]) == {str(user_gp.sub), str(user_p.sub)}
    assert set(results[str(document.id)]["users"]) == {
        str(user_gp.sub),
        str(user_p.sub),
        str(user_d.sub),
    }


@patch.object(FindDocumentIndexer, "push")
def test_services_search_indexers_ancestors_teams(mock_push):
    """Document accesses and reach should include teams from ancestors."""
    grand_parent = factories.DocumentFactory(teams=["team_gp"])
    parent = factories.DocumentFactory(parent=grand_parent, teams=["team_p"])
    document = factories.DocumentFactory(parent=parent, teams=["team_d"])

    FindDocumentIndexer().index()

    results = {doc["id"]: doc for doc in mock_push.call_args[0][0]}
    assert len(results) == 3
    assert results[str(grand_parent.id)]["groups"] == ["team_gp"]
    assert set(results[str(parent.id)]["groups"]) == {"team_gp", "team_p"}
    assert set(results[str(document.id)]["groups"]) == {"team_gp", "team_p", "team_d"}


@patch("requests.post")
def test_push_uses_correct_url_and_data(mock_post, settings):
    """
    push() should call requests.post with the correct URL from settings
    the timeout set to 10 seconds and the data as JSON.
    """
    settings.SEARCH_INDEXER_URL = "http://example.com/index"

    indexer = FindDocumentIndexer()
    sample_data = [{"id": "123", "title": "Test"}]

    mock_response = mock_post.return_value
    mock_response.raise_for_status.return_value = None  # No error

    indexer.push(sample_data)

    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args

    assert args[0] == settings.SEARCH_INDEXER_URL
    assert kwargs.get("json") == sample_data
    assert kwargs.get("timeout") == 10


def test_get_visited_document_ids_of():
    """
    get_visited_document_ids_of() returns the ids of the documents viewed
    by the user BUT without specific access configuration (like public ones)
    """
    user = factories.UserFactory()
    other = factories.UserFactory()
    anonymous = AnonymousUser()

    assert not get_visited_document_ids_of(anonymous)
    assert not get_visited_document_ids_of(user)

    doc1, doc2, _ = factories.DocumentFactory.create_batch(3)

    create_link = partial(models.LinkTrace.objects.create, user=user, is_masked=False)

    create_link(document=doc1)
    create_link(document=doc2)

    # The third document is not visited
    assert sorted(get_visited_document_ids_of(user)) == sorted(
        [str(doc1.pk), str(doc2.pk)]
    )

    factories.UserDocumentAccessFactory(user=other, document=doc1)
    factories.UserDocumentAccessFactory(user=user, document=doc2)

    # The second document have an access for the user
    assert get_visited_document_ids_of(user) == [str(doc1.pk)]


@patch("requests.post")
def test_services_search_indexers_search(mock_post, settings):
    """
    search() should call requests.post to SEARCH_INDEXER_QUERY_URL with the
    document ids from linktraces.
    """
    user = factories.UserFactory()
    indexer = FindDocumentIndexer()

    mock_response = mock_post.return_value
    mock_response.raise_for_status.return_value = None  # No error

    doc1, doc2, _ = factories.DocumentFactory.create_batch(3)

    create_link = partial(models.LinkTrace.objects.create, user=user, is_masked=False)

    create_link(document=doc1)
    create_link(document=doc2)

    indexer.search("alpha", user=user, token="mytoken")

    args, kwargs = mock_post.call_args

    assert args[0] == settings.SEARCH_INDEXER_QUERY_URL

    query_data = kwargs.get("json")
    assert query_data["q"] == "alpha"
    assert sorted(query_data["visited"]) == sorted([str(doc1.pk), str(doc2.pk)])
    assert query_data["services"] == ["docs"]

    assert kwargs.get("headers") == {"Authorization": "Bearer mytoken"}
    assert kwargs.get("timeout") == 10


def test_search_query_raises_error_if_search_endpoint_is_none(settings):
    """
    Indexer should raise RuntimeError if SEARCH_INDEXER_QUERY_URL is None or empty.
    """
    settings.SEARCH_INDEXER_QUERY_URL = None
    indexer = FindDocumentIndexer()
    user = factories.UserFactory()

    with pytest.raises(RuntimeError) as exc_info:
        indexer.search("alpha", user=user, token="mytoken")

    assert (
        "SEARCH_INDEXER_QUERY_URL must be set in Django settings before search."
        in str(exc_info.value)
    )
