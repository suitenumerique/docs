"""
Tests for Documents API endpoint in impress's core app: all

The 'all' endpoint returns ALL documents (including descendants) that the user has access to.
This is different from the 'list' endpoint which only returns top-level documents.
"""

from datetime import timedelta
from unittest import mock

from django.utils import timezone

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_documents_all_anonymous(reach, role):
    """
    Anonymous users should not be able to list any documents via the all endpoint
    whatever the link reach and link role.
    """
    parent = factories.DocumentFactory(link_reach=reach, link_role=role)
    factories.DocumentFactory(parent=parent, link_reach=reach, link_role=role)

    response = APIClient().get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 0


def test_api_documents_all_authenticated_with_children():
    """
    Authenticated users should see all documents including children,
    even though children don't have DocumentAccess records.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create a document tree: parent -> child -> grandchild
    parent = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=parent, user=user, role="owner")

    child = factories.DocumentFactory(parent=parent)
    grandchild = factories.DocumentFactory(parent=child)

    # Verify setup
    assert models.DocumentAccess.objects.filter(document=parent).count() == 1
    assert models.DocumentAccess.objects.filter(document=child).count() == 0
    assert models.DocumentAccess.objects.filter(document=grandchild).count() == 0

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]

    # All three documents should be returned (parent + child + grandchild)
    assert len(results) == 3
    results_ids = {result["id"] for result in results}
    assert results_ids == {str(parent.id), str(child.id), str(grandchild.id)}

    depths = {result["depth"] for result in results}
    assert depths == {1, 2, 3}


def test_api_documents_all_authenticated_multiple_trees():
    """
    Users should see all accessible documents from multiple document trees.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Tree 1: User has access
    tree1_parent = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=tree1_parent, user=user)
    tree1_child = factories.DocumentFactory(parent=tree1_parent)

    # Tree 2: User has access
    tree2_parent = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=tree2_parent, user=user)
    tree2_child1 = factories.DocumentFactory(parent=tree2_parent)
    tree2_child2 = factories.DocumentFactory(parent=tree2_parent)

    # Tree 3: User does NOT have access
    tree3_parent = factories.DocumentFactory()
    factories.DocumentFactory(parent=tree3_parent)

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]

    # Should return 5 documents (tree1: 2, tree2: 3, tree3: 0)
    assert len(results) == 5
    results_ids = {result["id"] for result in results}
    expected_ids = {
        str(tree1_parent.id),
        str(tree1_child.id),
        str(tree2_parent.id),
        str(tree2_child1.id),
        str(tree2_child2.id),
    }
    assert results_ids == expected_ids


def test_api_documents_all_authenticated_explicit_access_to_parent_and_child():
    """
    When a user has explicit DocumentAccess to both parent AND child,
    both should appear in the 'all' endpoint results (unlike 'list' which deduplicates).
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Parent with explicit access
    parent = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=parent, user=user)

    # Child also has explicit access (e.g., shared separately)
    child = factories.DocumentFactory(parent=parent)
    factories.UserDocumentAccessFactory(document=child, user=user)

    # Grandchild has no explicit access
    grandchild = factories.DocumentFactory(parent=child)

    # Verify setup
    assert models.DocumentAccess.objects.filter(document=parent).count() == 1
    assert models.DocumentAccess.objects.filter(document=child).count() == 1
    assert models.DocumentAccess.objects.filter(document=grandchild).count() == 0

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]

    # All three should appear
    assert len(results) == 3
    results_ids = {result["id"] for result in results}
    assert results_ids == {str(parent.id), str(child.id), str(grandchild.id)}

    # Each document should appear exactly once (no duplicates)
    results_ids_list = [result["id"] for result in results]
    assert len(results_ids_list) == len(set(results_ids_list))  # No duplicates


def test_api_documents_all_authenticated_via_team(mock_user_teams):
    """
    Users should see all documents (including descendants) for documents accessed via teams.
    """
    mock_user_teams.return_value = ["team1", "team2"]

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Document tree via team1
    parent1 = factories.DocumentFactory()
    factories.TeamDocumentAccessFactory(document=parent1, team="team1")
    child1 = factories.DocumentFactory(parent=parent1)

    # Document tree via team2
    parent2 = factories.DocumentFactory()
    factories.TeamDocumentAccessFactory(document=parent2, team="team2")
    child2 = factories.DocumentFactory(parent=parent2)

    # Document tree via unknown team
    parent3 = factories.DocumentFactory()
    factories.TeamDocumentAccessFactory(document=parent3, team="team3")
    factories.DocumentFactory(parent=parent3)

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]

    # Should return 4 documents (team1: 2, team2: 2, team3: 0)
    assert len(results) == 4
    results_ids = {result["id"] for result in results}
    expected_ids = {
        str(parent1.id),
        str(child1.id),
        str(parent2.id),
        str(child2.id),
    }
    assert results_ids == expected_ids


def test_api_documents_all_authenticated_soft_deleted():
    """
    Soft-deleted documents and their descendants should not be included.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Active tree
    active_parent = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=active_parent, user=user)
    active_child = factories.DocumentFactory(parent=active_parent)

    # Soft-deleted tree
    deleted_parent = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=deleted_parent, user=user)
    _deleted_child = factories.DocumentFactory(parent=deleted_parent)
    deleted_parent.soft_delete()

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]

    # Should only return active documents
    assert len(results) == 2
    results_ids = {result["id"] for result in results}
    assert results_ids == {str(active_parent.id), str(active_child.id)}


def test_api_documents_all_authenticated_permanently_deleted():
    """
    Permanently deleted documents should not be included.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Active tree
    active_parent = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=active_parent, user=user)
    active_child = factories.DocumentFactory(parent=active_parent)

    # Permanently deleted tree (deleted > 30 days ago)
    deleted_parent = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=deleted_parent, user=user)
    _deleted_child = factories.DocumentFactory(parent=deleted_parent)

    fourty_days_ago = timezone.now() - timedelta(days=40)
    with mock.patch("django.utils.timezone.now", return_value=fourty_days_ago):
        deleted_parent.soft_delete()

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]

    # Should only return active documents
    assert len(results) == 2
    results_ids = {result["id"] for result in results}
    assert results_ids == {str(active_parent.id), str(active_child.id)}


def test_api_documents_all_authenticated_link_reach_restricted():
    """
    Documents with link_reach=restricted accessed via LinkTrace should not appear
    in the all endpoint results.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Document with direct access (should appear)
    parent_with_access = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=parent_with_access, user=user)
    child_with_access = factories.DocumentFactory(parent=parent_with_access)

    # Document with only LinkTrace and restricted reach (should NOT appear)
    parent_restricted = factories.DocumentFactory(
        link_reach="restricted", link_traces=[user]
    )
    factories.DocumentFactory(parent=parent_restricted)

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]

    # Only documents with direct access should appear
    assert len(results) == 2
    results_ids = {result["id"] for result in results}
    assert results_ids == {str(parent_with_access.id), str(child_with_access.id)}


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_all_authenticated_link_reach_public_or_authenticated(reach):
    """
    Documents with link_reach=public or authenticated accessed via LinkTrace
    should appear with all their descendants.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Document accessed via LinkTrace with non-restricted reach
    parent = factories.DocumentFactory(link_reach=reach, link_traces=[user])
    child = factories.DocumentFactory(parent=parent)
    grandchild = factories.DocumentFactory(parent=child)

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]

    # All descendants should be included
    assert len(results) == 3
    results_ids = {result["id"] for result in results}
    assert results_ids == {str(parent.id), str(child.id), str(grandchild.id)}


def test_api_documents_all_format():
    """Validate the format of documents as returned by the all endpoint."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    access = factories.UserDocumentAccessFactory(document=document, user=user)
    child = factories.DocumentFactory(parent=document)

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    content = response.json()
    results = content.pop("results")

    # Check pagination structure
    assert content == {
        "count": 2,
        "next": None,
        "previous": None,
    }

    # Verify parent document format
    parent_result = [r for r in results if r["id"] == str(document.id)][0]
    assert parent_result == {
        "id": str(document.id),
        "abilities": document.get_abilities(user),
        "ancestors_link_reach": None,
        "ancestors_link_role": None,
        "computed_link_reach": document.computed_link_reach,
        "computed_link_role": document.computed_link_role,
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "deleted_at": None,
        "depth": 1,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "is_encrypted": document.is_encrypted,
        "link_reach": document.link_reach,
        "link_role": document.link_role,
        "nb_accesses_ancestors": 1,
        "nb_accesses_direct": 1,
        "numchild": 1,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": access.role,
    }

    # Verify child document format
    child_result = [r for r in results if r["id"] == str(child.id)][0]
    assert child_result["depth"] == 2
    assert child_result["user_role"] == access.role  # Inherited from parent
    assert child_result["nb_accesses_direct"] == 0  # No direct access on child


def test_api_documents_all_distinct():
    """
    A document should only appear once even if the user has multiple access paths to it.
    """
    user = factories.UserFactory()
    other_user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Document with multiple accesses for the same user
    document = factories.DocumentFactory(users=[user, other_user])
    child = factories.DocumentFactory(parent=document)

    response = client.get("/api/v1.0/documents/all/")

    assert response.status_code == 200
    results = response.json()["results"]

    # Should return 2 documents (parent + child), each appearing once
    assert len(results) == 2
    results_ids = [result["id"] for result in results]
    assert results_ids.count(str(document.id)) == 1
    assert results_ids.count(str(child.id)) == 1


def test_api_documents_all_comparison_with_list():
    """
    The 'all' endpoint should return more documents than 'list' when there are children.
    'list' returns only top-level documents, 'all' returns all descendants.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create a document tree
    parent = factories.DocumentFactory()
    factories.UserDocumentAccessFactory(document=parent, user=user)
    child = factories.DocumentFactory(parent=parent)
    grandchild = factories.DocumentFactory(parent=child)

    # Call list endpoint
    list_response = client.get("/api/v1.0/documents/")
    list_results = list_response.json()["results"]

    # Call all endpoint
    all_response = client.get("/api/v1.0/documents/all/")
    all_results = all_response.json()["results"]

    # list should return only parent
    assert len(list_results) == 1
    assert list_results[0]["id"] == str(parent.id)

    # all should return parent + child + grandchild
    assert len(all_results) == 3
    all_ids = {result["id"] for result in all_results}
    assert all_ids == {str(parent.id), str(child.id), str(grandchild.id)}
