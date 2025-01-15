"""
Tests for Documents API endpoint in impress's core app: list
"""

import operator
import random
from datetime import timedelta
from urllib.parse import urlencode

from django.utils import timezone

import pytest
from faker import Faker
from rest_framework.test import APIClient

from core import factories, models

fake = Faker()
pytestmark = pytest.mark.django_db


def test_api_documents_list_filter_and_access_rights():
    """Filtering on querystring parameters should respect access rights."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    other_user = factories.UserFactory()

    def random_favorited_by():
        return random.choice([[], [user], [other_user]])

    # Documents that should be listed to this user
    listed_documents = [
        factories.DocumentFactory(
            link_reach="public",
            link_traces=[user],
            favorited_by=random_favorited_by(),
            creator=random.choice([user, other_user]),
        ),
        factories.DocumentFactory(
            link_reach="authenticated",
            link_traces=[user],
            favorited_by=random_favorited_by(),
            creator=random.choice([user, other_user]),
        ),
        factories.DocumentFactory(
            link_reach="restricted",
            users=[user],
            favorited_by=random_favorited_by(),
            creator=random.choice([user, other_user]),
        ),
    ]
    listed_ids = [str(doc.id) for doc in listed_documents]
    word_list = [word for doc in listed_documents for word in doc.title.split(" ")]

    # Documents that should not be listed to this user
    factories.DocumentFactory(
        link_reach="public",
        favorited_by=random_favorited_by(),
        creator=random.choice([user, other_user]),
    )
    factories.DocumentFactory(
        link_reach="authenticated",
        favorited_by=random_favorited_by(),
        creator=random.choice([user, other_user]),
    )
    factories.DocumentFactory(
        link_reach="restricted",
        favorited_by=random_favorited_by(),
        creator=random.choice([user, other_user]),
    )
    factories.DocumentFactory(
        link_reach="restricted",
        link_traces=[user],
        favorited_by=random_favorited_by(),
        creator=random.choice([user, other_user]),
    )

    filters = {
        "link_reach": random.choice([None, *models.LinkReachChoices.values]),
        "title": random.choice([None, *word_list]),
        "favorite": random.choice([None, True, False]),
        "creator": random.choice([None, user, other_user]),
        "ordering": random.choice(
            [
                None,
                "created_at",
                "-created_at",
                "is_favorite",
                "-is_favorite",
                "nb_accesses",
                "-nb_accesses",
                "title",
                "-title",
                "updated_at",
                "-updated_at",
            ]
        ),
    }
    query_params = {key: value for key, value in filters.items() if value is not None}
    querystring = urlencode(query_params)

    response = client.get(f"/api/v1.0/documents/?{querystring:s}")

    assert response.status_code == 200
    results = response.json()["results"]

    # Ensure all documents in results respect expected access rights
    for result in results:
        assert result["id"] in listed_ids


# Filters: ordering


def test_api_documents_list_ordering_default():
    """Documents should be ordered by descending "updated_at" by default"""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(5, users=[user])

    response = client.get("/api/v1.0/documents/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 5

    # Check that results are sorted by descending "updated_at" as expected
    for i in range(4):
        assert operator.ge(results[i]["updated_at"], results[i + 1]["updated_at"])


def test_api_documents_list_ordering_by_fields():
    """It should be possible to order by several fields"""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(5, users=[user])

    for parameter in [
        "created_at",
        "-created_at",
        "is_favorite",
        "-is_favorite",
        "nb_accesses",
        "-nb_accesses",
        "title",
        "-title",
        "updated_at",
        "-updated_at",
    ]:
        is_descending = parameter.startswith("-")
        field = parameter.lstrip("-")
        querystring = f"?ordering={parameter}"

        response = client.get(f"/api/v1.0/documents/{querystring:s}")
        assert response.status_code == 200
        results = response.json()["results"]
        assert len(results) == 5

        # Check that results are sorted by the field in querystring as expected
        compare = operator.ge if is_descending else operator.le
        for i in range(4):
            assert compare(results[i][field], results[i + 1][field])


# Filters: is_creator_me


def test_api_documents_list_filter_is_creator_me_true():
    """
    Authenticated users should be able to filter documents they created.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(3, users=[user], creator=user)
    factories.DocumentFactory.create_batch(2, users=[user])

    response = client.get("/api/v1.0/documents/?is_creator_me=true")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 3

    # Ensure all results are created by the current user
    for result in results:
        assert result["creator"] == str(user.id)


def test_api_documents_list_filter_is_creator_me_false():
    """
    Authenticated users should be able to filter documents created by others.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(3, users=[user], creator=user)
    factories.DocumentFactory.create_batch(2, users=[user])

    response = client.get("/api/v1.0/documents/?is_creator_me=false")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2

    # Ensure all results are created by other users
    for result in results:
        assert result["creator"] != str(user.id)


def test_api_documents_list_filter_is_creator_me_invalid():
    """Filtering with an invalid `is_creator_me` value should do nothing."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(3, users=[user], creator=user)
    factories.DocumentFactory.create_batch(2, users=[user])

    response = client.get("/api/v1.0/documents/?is_creator_me=invalid")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 5


# Filters: is_favorite


def test_api_documents_list_filter_is_favorite_true():
    """
    Authenticated users should be able to filter documents they marked as favorite.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(3, users=[user], favorited_by=[user])
    factories.DocumentFactory.create_batch(2, users=[user])

    response = client.get("/api/v1.0/documents/?is_favorite=true")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 3

    # Ensure all results are marked as favorite by the current user
    for result in results:
        assert result["is_favorite"] is True


def test_api_documents_list_filter_is_favorite_false():
    """
    Authenticated users should be able to filter documents they didn't mark as favorite.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(3, users=[user], favorited_by=[user])
    factories.DocumentFactory.create_batch(2, users=[user])

    response = client.get("/api/v1.0/documents/?is_favorite=false")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2

    # Ensure all results are not marked as favorite by the current user
    for result in results:
        assert result["is_favorite"] is False


def test_api_documents_list_filter_is_favorite_invalid():
    """Filtering with an invalid `is_favorite` value should do nothing."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(3, users=[user], favorited_by=[user])
    factories.DocumentFactory.create_batch(2, users=[user])

    response = client.get("/api/v1.0/documents/?is_favorite=invalid")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 5


# Filters: link_reach


@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_documents_list_filter_link_reach(reach):
    """Authenticated users should be able to filter documents by link reach."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(5, users=[user])

    response = client.get(f"/api/v1.0/documents/?link_reach={reach:s}")

    assert response.status_code == 200
    results = response.json()["results"]

    # Ensure all results have the chosen link reach
    for result in results:
        assert result["link_reach"] == reach


def test_api_documents_list_filter_link_reach_invalid():
    """Filtering with an invalid `link_reach` value should raise an error."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(3, users=[user])

    response = client.get("/api/v1.0/documents/?link_reach=invalid")

    assert response.status_code == 400
    assert response.json() == {
        "link_reach": [
            "Select a valid choice. invalid is not one of the available choices."
        ]
    }


# Filters: title


@pytest.mark.parametrize(
    "query,nb_results",
    [
        ("Project Alpha", 1),  # Exact match
        ("project", 2),  # Partial match (case-insensitive)
        ("Guide", 1),  # Word match within a title
        ("Special", 0),  # No match (nonexistent keyword)
        ("2024", 2),  # Match by numeric keyword
        ("", 5),  # Empty string
    ],
)
def test_api_documents_list_filter_title(query, nb_results):
    """Authenticated users should be able to search documents by their title."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # Create documents with predefined titles
    titles = [
        "Project Alpha Documentation",
        "Project Beta Overview",
        "User Guide",
        "Financial Report 2024",
        "Annual Review 2024",
    ]
    for title in titles:
        factories.DocumentFactory(title=title, users=[user])

    # Perform the search query
    response = client.get(f"/api/v1.0/documents/?title={query:s}")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == nb_results

    # Ensure all results contain the query in their title
    for result in results:
        assert query.lower().strip() in result["title"].lower()


# Filters: is_deleted


@pytest.mark.parametrize("depth", [1, 2, 3])
@pytest.mark.parametrize("role", models.RoleChoices.values)
@pytest.mark.parametrize(
    "querystring", ["?is_deleted=true", "?is_deleted=True", "?is_deleted=1"]
)
def test_api_documents_list_filter_is_deleted_true(querystring, role, depth):
    """
    Authenticated users should be able to filter documents in the trashbin if
    they are an owner of the document.
    (soft deleted for a period shorter than the limit configured in settings)
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    tree = []
    tree_with_delete = []
    for i in range(depth):
        tree.append(
            factories.UserDocumentAccessFactory(role=role, user=user).document
            if i == 0
            else factories.DocumentFactory(parent=tree[-1])
        )
        tree_with_delete.append(
            factories.UserDocumentAccessFactory(role=role, user=user).document
            if i == 0
            else factories.DocumentFactory(parent=tree_with_delete[-1])
        )

    # Soft delete a document
    now = timezone.now()
    deleted_document = random.choice(tree_with_delete)
    deleted_document.deleted_at = now - timedelta(days=15)
    deleted_document.save()

    response = client.get(f"/api/v1.0/documents/{querystring:s}")

    assert response.status_code == 200
    results = response.json()["results"]

    if role == "owner":
        assert len(results) == 1
        assert results[0]["id"] == str(deleted_document.id)
    else:
        assert len(results) == 0

    # Hard delete the document
    deleted_document.deleted_at = now - timedelta(days=40)
    deleted_document.save()

    response = client.get(f"/api/v1.0/documents/{querystring:s}")

    assert response.status_code == 200
    results = response.json()["results"]

    assert len(results) == 0


@pytest.mark.parametrize(
    "querystring", ["", "?is_deleted=false", "?is_deleted=False", "?is_deleted=0"]
)
def test_api_documents_list_filter_is_deleted_false(querystring):
    """
    Authenticated users should be able to filter documents that are not deleted.
    It should be the default filter for `is_deleted`.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    doc_soft, doc_hard, *documents = factories.DocumentFactory.create_batch(
        5, users=[user]
    )
    expected_ids = {str(document.id) for document in documents}

    # Soft delete a document
    now = timezone.now()
    doc_soft.deleted_at = now - timedelta(days=15)
    doc_soft.save()

    # Hard delete a document
    doc_hard.deleted_at = now - timedelta(days=40)
    doc_hard.save()

    response = client.get(f"/api/v1.0/documents/{querystring:s}")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 3
    results_ids = {result["id"] for result in results}
    assert results_ids == expected_ids


def test_api_documents_list_filter_is_deleted_invalid():
    """Filtering with an invalid `is_deleted` value should do nothing."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(5, users=[user])

    response = client.get("/api/v1.0/documents/?is_deleted=invalid")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 5
