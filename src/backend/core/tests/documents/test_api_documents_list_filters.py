"""
Tests for Documents API endpoint in impress's core app: list
"""

import operator
import random
from urllib.parse import urlencode

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


# Filters: unknown field


def test_api_documents_list_filter_unknown_field():
    """
    Trying to filter by an unknown field should raise a 400 error.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory()
    expected_ids = {
        str(document.id)
        for document in factories.DocumentFactory.create_batch(2, users=[user])
    }

    response = client.get("/api/v1.0/documents/?unknown=true")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2
    assert {result["id"] for result in results} == expected_ids


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


# Filters: is_masked


def test_api_documents_list_filter_is_masked_true():
    """
    Authenticated users should be able to filter documents they marked as masked.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(2, users=[user])
    masked_documents = factories.DocumentFactory.create_batch(
        3, users=[user], masked_by=[user]
    )
    unmasked_documents = factories.DocumentFactory.create_batch(2, users=[user])
    for document in unmasked_documents:
        models.LinkTrace.objects.create(document=document, user=user, is_masked=False)

    response = client.get("/api/v1.0/documents/?is_masked=true")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 3

    # Ensure all results are marked as masked by the current user
    masked_documents_ids = [str(doc.id) for doc in masked_documents]
    for result in results:
        assert result["id"] in masked_documents_ids


def test_api_documents_list_filter_is_masked_false():
    """
    Authenticated users should be able to filter documents they didn't mark as masked.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(2, users=[user])
    masked_documents = factories.DocumentFactory.create_batch(
        3, users=[user], masked_by=[user]
    )
    unmasked_documents = factories.DocumentFactory.create_batch(2, users=[user])
    for document in unmasked_documents:
        models.LinkTrace.objects.create(document=document, user=user, is_masked=False)

    response = client.get("/api/v1.0/documents/?is_masked=false")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 4

    # Ensure all results are not marked as masked by the current user
    masked_documents_ids = [str(doc.id) for doc in masked_documents]
    for result in results:
        assert result["id"] not in masked_documents_ids


def test_api_documents_list_filter_is_masked_invalid():
    """Filtering with an invalid `is_masked` value should do nothing."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory.create_batch(2, users=[user])
    factories.DocumentFactory.create_batch(3, users=[user], masked_by=[user])
    unmasked_documents = factories.DocumentFactory.create_batch(2, users=[user])
    for document in unmasked_documents:
        models.LinkTrace.objects.create(document=document, user=user, is_masked=False)

    response = client.get("/api/v1.0/documents/?is_masked=invalid")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 7


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
        parent = factories.DocumentFactory() if random.choice([True, False]) else None
        factories.DocumentFactory(title=title, users=[user], parent=parent)

    # Perform the search query
    response = client.get(f"/api/v1.0/documents/?title={query:s}")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == nb_results

    # Ensure all results contain the query in their title
    for result in results:
        assert query.lower().strip() in result["title"].lower()
