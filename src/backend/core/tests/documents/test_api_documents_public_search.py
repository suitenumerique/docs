"""
Tests for Documents API endpoint: public_search action.
"""

import datetime

from django.test import RequestFactory
from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_api_documents_public_search_missing_q():
    """Missing `q` param should return 400."""
    client = APIClient()

    document = factories.DocumentFactory(link_reach="public")
    response = client.get(
        f"/api/v1.0/documents/{document.id}/public_search/",
        data={},
    )

    assert response.status_code == 400
    assert response.json() == {"q": ["This field is required."]}


def test_api_documents_public_search_blank_q():
    """Blank `q` param should return all documents in the public tree."""
    client = APIClient()
    document = factories.DocumentFactory(link_reach="public")
    child = factories.DocumentFactory(parent=document)

    response = client.get(
        f"/api/v1.0/documents/{document.id}/public_search/",
        data={"q": "   "},
    )

    assert response.status_code == 200
    result_ids = {r["id"] for r in response.json()["results"]}
    assert len(result_ids) == 2
    assert str(document.id) in result_ids
    assert str(child.id) in result_ids


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------


def test_api_documents_public_search_anonymous_on_public_document_tree():
    """Anonymous users can search within a public document's tree."""
    client = APIClient()

    document = factories.DocumentFactory(link_reach="public")
    match = factories.DocumentFactory(parent=document, title="match me")
    no_match = factories.DocumentFactory(parent=document, title="don't find me")

    response = client.get(
        f"/api/v1.0/documents/{document.id}/public_search/",
        data={"q": "match"},
    )
    assert response.status_code == 200

    result_ids = {r["id"] for r in response.json()["results"]}
    assert str(match.id) in result_ids
    assert str(no_match.id) not in result_ids


def test_api_documents_public_search_anonymous_on_restricted_document():
    """Anonymous users cannot search on a restricted document."""
    client = APIClient()
    document = factories.DocumentFactory(link_reach="restricted")

    response = client.get(
        f"/api/v1.0/documents/{document.id}/public_search/",
        data={"q": "anything"},
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_documents_public_search_anonymous_on_authenticated_document():
    """Anonymous users cannot search on an authenticated-only document."""
    client = APIClient()
    document = factories.DocumentFactory(link_reach="authenticated")

    response = client.get(
        f"/api/v1.0/documents/{document.id}/public_search/",
        data={"q": "anything"},
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_documents_public_search_authenticated_on_restricted_document():
    """Authenticated users cannot search on a restricted document they don't own."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id}/public_search/",
        data={"q": "anything"},
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

def test_api_documents_public_search_authenticated_on_authenticated_document():
    """Authenticated users cannot search on a authenticated document they don't own."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="authenticated")

    client = APIClient()
    client.force_login(user)
    response = client.get(
        f"/api/v1.0/documents/{document.id}/public_search/",
        data={"q": "anything"},
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

# ---------------------------------------------------------------------------
# Public via ancestor
# ---------------------------------------------------------------------------


def test_api_documents_public_search_document_public_via_ancestor():
    """
    A restricted child document whose ancestor is public is effectively public.
    The search scope should be rooted at the highest public ancestor.
    """
    client = APIClient()

    root = factories.DocumentFactory(link_reach="public", title="root")
    child = factories.DocumentFactory(
        parent=root, link_reach="restricted", title="child alpha"
    )
    sibling = factories.DocumentFactory(parent=root, title="sibling alpha")
    grand_child = factories.DocumentFactory(parent=child, title="grand alpha")

    # child is public via root
    assert child.computed_link_reach == models.LinkReachChoices.PUBLIC

    response = client.get(
        f"/api/v1.0/documents/{child.id}/public_search/",
        data={"q": "alpha"},
    )
    assert response.status_code == 200

    content = response.json()
    result_ids = {r["id"] for r in content["results"]}

    # All descendants of root that match "alpha" should be returned
    assert str(child.id) in result_ids
    assert str(sibling.id) in result_ids
    assert str(grand_child.id) in result_ids


def test_api_documents_public_search_scope_limited_to_public_tree():
    """
    Documents outside the public tree should not appear in results, even if they
    match the query.
    """
    client = APIClient()

    private_root = factories.DocumentFactory(
        link_reach="restricted", title="private root"
    )
    public_doc = factories.DocumentFactory(
        parent=private_root, link_reach="public", title="public doc"
    )
    inside = factories.DocumentFactory(parent=public_doc, title="alpha inside")

    # Separate tree — should never appear
    other_root = factories.DocumentFactory(link_reach="public", title="other root")
    outside = factories.DocumentFactory(parent=other_root, title="alpha outside")

    response = client.get(
        f"/api/v1.0/documents/{public_doc.id}/public_search/",
        data={"q": "alpha"},
    )
    assert response.status_code == 200

    result_ids = {r["id"] for r in response.json()["results"]}
    assert str(inside.id) in result_ids
    assert str(outside.id) not in result_ids


def test_api_documents_public_search_excludes_deleted_documents():
    """Soft-deleted documents should not appear in results."""
    client = APIClient()
    root = factories.DocumentFactory(link_reach="public")
    alive = factories.DocumentFactory(parent=root, title="alive alpha")
    deleted = factories.DocumentFactory(
        parent=root,
        title="deleted alpha",
        deleted_at="2024-01-01T00:00:00Z",
        ancestors_deleted_at="2024-01-01T00:00:00Z",
    )

    response = client.get(
        f"/api/v1.0/documents/{root.id}/public_search/",
        data={"q": "alpha"},
    )
    assert response.status_code == 200

    result_ids = {r["id"] for r in response.json()["results"]}
    assert str(alive.id) in result_ids
    assert str(deleted.id) not in result_ids


def test_api_documents_public_search_excludes_documents_with_deleted_ancestor():
    """Documents whose ancestor is deleted should not appear in results."""
    client = APIClient()
    root = factories.DocumentFactory(link_reach="public")
    deleted_parent = factories.DocumentFactory(
        parent=root,
        title="deleted parent",
        deleted_at="2024-01-01T00:00:00Z",
        ancestors_deleted_at="2024-01-01T00:00:00Z",
    )
    orphan = factories.DocumentFactory(
        parent=deleted_parent,
        title="orphan alpha",
        ancestors_deleted_at="2024-01-01T00:00:00Z",
    )
    alive = factories.DocumentFactory(parent=root, title="alive alpha")

    response = client.get(
        f"/api/v1.0/documents/{root.id}/public_search/",
        data={"q": "alpha"},
    )

    assert response.status_code == 200

    result_ids = {r["id"] for r in response.json()["results"]}
    assert str(alive.id) in result_ids
    assert str(orphan.id) not in result_ids


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------


def test_api_documents_public_search_ordered_by_most_recent_first():
    """Results should be ordered by -updated_at."""
    client = APIClient()

    root_doc = factories.DocumentFactory(link_reach="public")
    old = factories.DocumentFactory(parent=root_doc, title="old alpha")
    new = factories.DocumentFactory(parent=root_doc, title="new alpha")

    # Force updated_at ordering
    models.Document.objects.filter(pk=old.pk).update(
        updated_at=timezone.now() - datetime.timedelta(days=10)
    )
    models.Document.objects.filter(pk=new.pk).update(updated_at=timezone.now())

    response = client.get(
        f"/api/v1.0/documents/{root_doc.id}/public_search/",
        data={"q": "alpha"},
    )
    assert response.status_code == 200

    result_ids = [r["id"] for r in response.json()["results"]]
    assert result_ids.index(str(new.id)) < result_ids.index(str(old.id))
