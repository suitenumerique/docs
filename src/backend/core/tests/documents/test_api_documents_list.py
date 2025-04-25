"""
Tests for Documents API endpoint in impress's core app: list
"""

import random
from datetime import timedelta
from unittest import mock

from django.utils import timezone

import pytest
from faker import Faker
from rest_framework.pagination import PageNumberPagination
from rest_framework.test import APIClient

from core import factories, models

fake = Faker()
pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_documents_list_anonymous(reach, role):
    """
    Anonymous users should not be allowed to list documents whatever the
    link reach and link role
    """
    factories.DocumentFactory(link_reach=reach, link_role=role)

    response = APIClient().get("/api/v1.0/documents/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 0


def test_api_documents_list_format():
    """Validate the format of documents as returned by the list view."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_users = factories.UserFactory.create_batch(3)
    document = factories.DocumentFactory(
        users=factories.UserFactory.create_batch(2),
        favorited_by=[user, *other_users],
        link_traces=other_users,
    )
    access = factories.UserDocumentAccessFactory(document=document, user=user)

    response = client.get("/api/v1.0/documents/")

    assert response.status_code == 200
    content = response.json()
    results = content.pop("results")
    assert content == {
        "count": 1,
        "next": None,
        "previous": None,
    }
    assert len(results) == 1
    assert results[0] == {
        "id": str(document.id),
        "abilities": document.get_abilities(user),
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 1,
        "excerpt": document.excerpt,
        "is_favorite": True,
        "link_reach": document.link_reach,
        "link_role": document.link_role,
        "nb_accesses_ancestors": 3,
        "nb_accesses_direct": 3,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": access.role,
    }


# pylint: disable=too-many-locals
def test_api_documents_list_authenticated_direct(django_assert_num_queries):
    """
    Authenticated users should be able to list documents they are a direct
    owner/administrator/member of or documents that have a link reach other
    than restricted.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document1, document2 = [
        access.document
        for access in factories.UserDocumentAccessFactory.create_batch(2, user=user)
    ]

    # Unrelated and untraced documents
    for reach in models.LinkReachChoices:
        for role in models.LinkRoleChoices:
            factories.DocumentFactory(link_reach=reach, link_role=role)

    # Children of visible documents should not get listed even with a specific access
    factories.DocumentFactory(parent=document1)

    child1_with_access = factories.DocumentFactory(parent=document1)
    factories.UserDocumentAccessFactory(user=user, document=child1_with_access)

    middle_document = factories.DocumentFactory(parent=document2)
    child2_with_access = factories.DocumentFactory(parent=middle_document)
    factories.UserDocumentAccessFactory(user=user, document=child2_with_access)

    # Children of hidden documents should get listed when visible by the logged-in user
    hidden_root = factories.DocumentFactory()
    child3_with_access = factories.DocumentFactory(parent=hidden_root)
    factories.UserDocumentAccessFactory(user=user, document=child3_with_access)
    child4_with_access = factories.DocumentFactory(parent=hidden_root)
    factories.UserDocumentAccessFactory(user=user, document=child4_with_access)

    # Documents that are soft deleted and children of a soft deleted document should not be listed
    soft_deleted_document = factories.DocumentFactory(users=[user])
    child_of_soft_deleted_document = factories.DocumentFactory(
        users=[user],
        parent=soft_deleted_document,
    )
    factories.DocumentFactory(users=[user], parent=child_of_soft_deleted_document)
    soft_deleted_document.soft_delete()

    # Documents that are permanently deleted and children of a permanently deleted
    # document should not be listed
    permanently_deleted_document = factories.DocumentFactory(users=[user])
    child_of_permanently_deleted_document = factories.DocumentFactory(
        users=[user], parent=permanently_deleted_document
    )
    factories.DocumentFactory(
        users=[user], parent=child_of_permanently_deleted_document
    )

    fourty_days_ago = timezone.now() - timedelta(days=40)
    with mock.patch("django.utils.timezone.now", return_value=fourty_days_ago):
        permanently_deleted_document.soft_delete()

    expected_ids = {
        str(document1.id),
        str(document2.id),
        str(child3_with_access.id),
        str(child4_with_access.id),
    }

    with django_assert_num_queries(14):
        response = client.get("/api/v1.0/documents/")

    # nb_accesses should now be cached
    with django_assert_num_queries(6):
        response = client.get("/api/v1.0/documents/")

    assert response.status_code == 200
    results = response.json()["results"]
    results_ids = {result["id"] for result in results}
    assert expected_ids == results_ids


def test_api_documents_list_authenticated_via_team(
    django_assert_num_queries, mock_user_teams
):
    """
    Authenticated users should be able to list documents they are a
    owner/administrator/member of via a team.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    mock_user_teams.return_value = ["team1", "team2", "unknown"]

    documents_team1 = [
        access.document
        for access in factories.TeamDocumentAccessFactory.create_batch(2, team="team1")
    ]
    documents_team2 = [
        access.document
        for access in factories.TeamDocumentAccessFactory.create_batch(3, team="team2")
    ]

    expected_ids = {str(document.id) for document in documents_team1 + documents_team2}

    with django_assert_num_queries(14):
        response = client.get("/api/v1.0/documents/")

    # nb_accesses should now be cached
    with django_assert_num_queries(4):
        response = client.get("/api/v1.0/documents/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 5
    results_id = {result["id"] for result in results}
    assert expected_ids == results_id


def test_api_documents_list_authenticated_link_reach_restricted(
    django_assert_num_queries,
):
    """
    An authenticated user who has link traces to a document that is restricted should not
    see it on the list view
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_traces=[user], link_reach="restricted")

    # Link traces for other documents or other users should not interfere
    models.LinkTrace.objects.create(document=document, user=factories.UserFactory())
    other_document = factories.DocumentFactory(link_reach="public")
    models.LinkTrace.objects.create(document=other_document, user=user)

    with django_assert_num_queries(6):
        response = client.get("/api/v1.0/documents/")

    # nb_accesses should now be cached
    with django_assert_num_queries(4):
        response = client.get("/api/v1.0/documents/")

    assert response.status_code == 200
    results = response.json()["results"]
    # Only the other document is returned but not the restricted document even though the user
    # visited it earlier (probably b/c it previously had public or authenticated reach...)
    assert len(results) == 1
    assert results[0]["id"] == str(other_document.id)


def test_api_documents_list_authenticated_link_reach_public_or_authenticated(
    django_assert_num_queries,
):
    """
    An authenticated user who has link traces to a document with public or authenticated
    link reach should see it on the list view.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document1, document2 = [
        factories.DocumentFactory(link_traces=[user], link_reach=reach)
        for reach in models.LinkReachChoices
        if reach != "restricted"
    ]
    factories.DocumentFactory(
        link_reach=random.choice(["public", "authenticated"]),
        link_traces=[user],
        parent=document1,
    )

    hidden_document = factories.DocumentFactory(
        link_reach=random.choice(["public", "authenticated"])
    )
    visible_child = factories.DocumentFactory(
        link_traces=[user],
        link_reach=random.choice(["public", "authenticated"]),
        parent=hidden_document,
    )

    expected_ids = {str(document1.id), str(document2.id), str(visible_child.id)}

    with django_assert_num_queries(11):
        response = client.get("/api/v1.0/documents/")

    # nb_accesses should now be cached
    with django_assert_num_queries(5):
        response = client.get("/api/v1.0/documents/")

    assert response.status_code == 200
    results = response.json()["results"]
    results_id = {result["id"] for result in results}
    assert expected_ids == results_id


@mock.patch.object(PageNumberPagination, "get_page_size", return_value=2)
def test_api_documents_list_pagination(
    _mock_page_size,
):
    """Pagination should work as expected."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document_ids = [
        str(access.document_id)
        for access in factories.UserDocumentAccessFactory.create_batch(3, user=user)
    ]

    # Get page 1
    response = client.get(
        "/api/v1.0/documents/",
    )

    assert response.status_code == 200
    content = response.json()

    assert content["count"] == 3
    assert content["next"] == "http://testserver/api/v1.0/documents/?page=2"
    assert content["previous"] is None

    assert len(content["results"]) == 2
    for item in content["results"]:
        document_ids.remove(item["id"])

    # Get page 2
    response = client.get(
        "/api/v1.0/documents/?page=2",
    )

    assert response.status_code == 200
    content = response.json()

    assert content["count"] == 3
    assert content["next"] is None
    assert content["previous"] == "http://testserver/api/v1.0/documents/"

    assert len(content["results"]) == 1
    document_ids.remove(content["results"][0]["id"])
    assert document_ids == []


def test_api_documents_list_pagination_force_page_size():
    """Page size can be set via querystring."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document_ids = [
        str(access.document_id)
        for access in factories.UserDocumentAccessFactory.create_batch(3, user=user)
    ]

    # Force page size
    response = client.get(
        "/api/v1.0/documents/?page_size=2",
    )

    assert response.status_code == 200
    content = response.json()

    assert content["count"] == 3
    assert content["next"] == "http://testserver/api/v1.0/documents/?page=2&page_size=2"
    assert content["previous"] is None

    assert len(content["results"]) == 2
    for item in content["results"]:
        document_ids.remove(item["id"])


def test_api_documents_list_authenticated_distinct():
    """A document with several related users should only be listed once."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()

    document = factories.DocumentFactory(users=[user, other_user])

    response = client.get(
        "/api/v1.0/documents/",
    )

    assert response.status_code == 200
    content = response.json()
    assert len(content["results"]) == 1
    assert content["results"][0]["id"] == str(document.id)


def test_api_documents_list_favorites_no_extra_queries(django_assert_num_queries):
    """
    Ensure that marking documents as favorite does not generate additional queries
    when fetching the document list.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    special_documents = factories.DocumentFactory.create_batch(3, users=[user])
    factories.DocumentFactory.create_batch(2, users=[user])

    url = "/api/v1.0/documents/"
    with django_assert_num_queries(14):
        response = client.get(url)

    # nb_accesses should now be cached
    with django_assert_num_queries(4):
        response = client.get(url)

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 5

    assert all(result["is_favorite"] is False for result in results)

    # Mark documents as favorite and check results again
    for document in special_documents:
        models.DocumentFavorite.objects.create(document=document, user=user)

    with django_assert_num_queries(4):
        response = client.get(url)

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 5

    # Check if the "is_favorite" annotation is correctly set for the favorited documents
    favorited_ids = {str(doc.id) for doc in special_documents}
    for result in results:
        if result["id"] in favorited_ids:
            assert result["is_favorite"] is True
        else:
            assert result["is_favorite"] is False
