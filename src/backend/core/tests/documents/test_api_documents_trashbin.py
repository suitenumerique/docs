"""
Tests for Documents API endpoint in impress's core app: list
"""

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
def test_api_documents_trashbin_anonymous(reach, role):
    """
    Anonymous users should not be allowed to list documents from the trashbin
    whatever the link reach and link role
    """
    factories.DocumentFactory(
        link_reach=reach, link_role=role, deleted_at=timezone.now()
    )

    response = APIClient().get("/api/v1.0/documents/trashbin/")

    assert response.status_code == 200
    assert response.json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }


def test_api_documents_trashbin_format():
    """Validate the format of documents as returned by the trashbin view."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_users = factories.UserFactory.create_batch(3)
    document = factories.DocumentFactory(
        deleted_at=timezone.now(),
        users=factories.UserFactory.create_batch(2),
        favorited_by=[user, *other_users],
        link_traces=other_users,
    )
    factories.UserDocumentAccessFactory(document=document, user=user, role="owner")

    response = client.get("/api/v1.0/documents/trashbin/")

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
        "abilities": {
            "accesses_manage": True,
            "accesses_view": True,
            "ai_transform": True,
            "ai_translate": True,
            "attachment_upload": True,
            "children_create": True,
            "children_list": True,
            "collaboration_auth": True,
            "descendants": True,
            "cors_proxy": True,
            "destroy": True,
            "duplicate": True,
            "favorite": True,
            "invite_owner": True,
            "link_configuration": True,
            "link_select_options": {
                "authenticated": ["reader", "editor"],
                "public": ["reader", "editor"],
                "restricted": None,
            },
            "media_auth": True,
            "media_check": True,
            "move": False,  # Can't move a deleted document
            "partial_update": True,
            "restore": True,
            "retrieve": True,
            "tree": True,
            "update": True,
            "versions_destroy": True,
            "versions_list": True,
            "versions_retrieve": True,
        },
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 1,
        "excerpt": document.excerpt,
        "link_reach": document.link_reach,
        "link_role": document.link_role,
        "nb_accesses_ancestors": 0,
        "nb_accesses_direct": 3,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": "owner",
    }


def test_api_documents_trashbin_authenticated_direct(django_assert_num_queries):
    """
    The trashbin should only list deleted documents for which the current user is owner.
    """
    now = timezone.now()
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document1, document2 = factories.DocumentFactory.create_batch(2, deleted_at=now)
    models.DocumentAccess.objects.create(document=document1, user=user, role="owner")
    models.DocumentAccess.objects.create(document=document2, user=user, role="owner")

    # Unrelated documents
    for reach in models.LinkReachChoices:
        for role in models.LinkRoleChoices:
            factories.DocumentFactory(link_reach=reach, link_role=role, deleted_at=now)

    # Role other than "owner"
    for role in models.RoleChoices.values:
        if role == "owner":
            continue
        document_not_owner = factories.DocumentFactory(deleted_at=now)
        models.DocumentAccess.objects.create(
            document=document_not_owner, user=user, role=role
        )

    # Nested documents should also get listed
    parent = factories.DocumentFactory(parent=document1)
    document3 = factories.DocumentFactory(parent=parent, deleted_at=now)
    models.DocumentAccess.objects.create(document=parent, user=user, role="owner")

    # Permanently deleted documents should not be listed
    fourty_days_ago = timezone.now() - timedelta(days=40)
    permanently_deleted_document = factories.DocumentFactory(users=[(user, "owner")])
    with mock.patch("django.utils.timezone.now", return_value=fourty_days_ago):
        permanently_deleted_document.soft_delete()

    expected_ids = {str(document1.id), str(document2.id), str(document3.id)}

    with django_assert_num_queries(10):
        response = client.get("/api/v1.0/documents/trashbin/")

    with django_assert_num_queries(4):
        response = client.get("/api/v1.0/documents/trashbin/")

    assert response.status_code == 200
    results = response.json()["results"]
    results_ids = {result["id"] for result in results}
    assert len(results) == 3
    assert expected_ids == results_ids


def test_api_documents_trashbin_authenticated_via_team(
    django_assert_num_queries, mock_user_teams
):
    """
    Authenticated users should be able to list trashbin documents they own via a team.
    """
    now = timezone.now()
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    mock_user_teams.return_value = ["team1", "team2", "unknown"]

    deleted_document_team1 = factories.DocumentFactory(
        teams=[("team1", "owner")], deleted_at=now
    )
    factories.DocumentFactory(teams=[("team1", "owner")])
    factories.DocumentFactory(teams=[("team1", "administrator")], deleted_at=now)
    factories.DocumentFactory(teams=[("team1", "administrator")])
    deleted_document_team2 = factories.DocumentFactory(
        teams=[("team2", "owner")], deleted_at=now
    )
    factories.DocumentFactory(teams=[("team2", "owner")])
    factories.DocumentFactory(teams=[("team2", "administrator")], deleted_at=now)
    factories.DocumentFactory(teams=[("team2", "administrator")])

    expected_ids = {str(deleted_document_team1.id), str(deleted_document_team2.id)}

    with django_assert_num_queries(7):
        response = client.get("/api/v1.0/documents/trashbin/")

    with django_assert_num_queries(3):
        response = client.get("/api/v1.0/documents/trashbin/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2
    results_id = {result["id"] for result in results}
    assert expected_ids == results_id


@mock.patch.object(PageNumberPagination, "get_page_size", return_value=2)
def test_api_documents_trashbin_pagination(
    _mock_page_size,
):
    """Pagination should work as expected."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document_ids = [
        str(document.id)
        for document in factories.DocumentFactory.create_batch(
            3, deleted_at=timezone.now()
        )
    ]
    for document_id in document_ids:
        models.DocumentAccess.objects.create(
            document_id=document_id, user=user, role="owner"
        )

    # Get page 1
    response = client.get("/api/v1.0/documents/trashbin/")

    assert response.status_code == 200
    content = response.json()

    assert content["count"] == 3
    assert content["next"] == "http://testserver/api/v1.0/documents/trashbin/?page=2"
    assert content["previous"] is None

    assert len(content["results"]) == 2
    for item in content["results"]:
        document_ids.remove(item["id"])

    # Get page 2
    response = client.get(
        "/api/v1.0/documents/trashbin/?page=2",
    )

    assert response.status_code == 200
    content = response.json()

    assert content["count"] == 3
    assert content["next"] is None
    assert content["previous"] == "http://testserver/api/v1.0/documents/trashbin/"

    assert len(content["results"]) == 1
    document_ids.remove(content["results"][0]["id"])
    assert document_ids == []


def test_api_documents_trashbin_distinct():
    """A document with several related users should only be listed once."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()
    document = factories.DocumentFactory(
        users=[(user, "owner"), other_user], deleted_at=timezone.now()
    )

    response = client.get(
        "/api/v1.0/documents/trashbin/",
    )

    assert response.status_code == 200
    content = response.json()
    assert len(content["results"]) == 1
    assert content["results"][0]["id"] == str(document.id)
