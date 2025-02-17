"""
Tests for Documents API endpoint in impress's core app: list
"""

import pytest
from faker import Faker
from rest_framework.test import APIClient

from core import factories

fake = Faker()
pytestmark = pytest.mark.django_db


# Filters: unknown field


def test_api_documents_descendants_filter_unknown_field():
    """
    Trying to filter by an unknown field should be ignored.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    factories.DocumentFactory()

    document = factories.DocumentFactory(users=[user])
    expected_ids = {
        str(document.id)
        for document in factories.DocumentFactory.create_batch(2, parent=document)
    }

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/descendants/?unknown=true"
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2
    assert {result["id"] for result in results} == expected_ids


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
def test_api_documents_descendants_filter_title(query, nb_results):
    """Authenticated users should be able to search documents by their title."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[user])

    # Create documents with predefined titles
    titles = [
        "Project Alpha Documentation",
        "Project Beta Overview",
        "User Guide",
        "Financial Report 2024",
        "Annual Review 2024",
    ]
    for title in titles:
        factories.DocumentFactory(title=title, parent=document)

    # Perform the search query
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/descendants/?title={query:s}"
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == nb_results

    # Ensure all results contain the query in their title
    for result in results:
        assert query.lower().strip() in result["title"].lower()
