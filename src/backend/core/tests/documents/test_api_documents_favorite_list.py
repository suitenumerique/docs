"""Test for the document favorite_list endpoint."""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_api_document_favorite_list_anonymous():
    """Anonymous users should receive a 401 error."""
    client = APIClient()

    response = client.get("/api/v1.0/documents/favorite_list/")

    assert response.status_code == 401


def test_api_document_favorite_list_authenticated_no_favorite():
    """Authenticated users should receive an empty list."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = client.get("/api/v1.0/documents/favorite_list/")

    assert response.status_code == 200
    assert response.json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }


def test_api_document_favorite_list_authenticated_with_favorite():
    """Authenticated users with a favorite should receive the favorite."""

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    # User don't have access to this document, let say it had access and this access has been
    # removed. It should not be in the favorite list anymore.
    factories.DocumentFactory(favorited_by=[user])

    document = factories.UserDocumentAccessFactory(
        user=user, role=models.RoleChoices.READER, document__favorited_by=[user]
    ).document

    response = client.get("/api/v1.0/documents/favorite_list/")

    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": document.get_abilities(user),
                "ancestors_link_reach": None,
                "ancestors_link_role": None,
                "computed_link_reach": document.computed_link_reach,
                "computed_link_role": document.computed_link_role,
                "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(document.creator.id),
                "content": document.content,
                "depth": document.depth,
                "excerpt": document.excerpt,
                "id": str(document.id),
                "is_favorite": True,
                "link_reach": document.link_reach,
                "link_role": document.link_role,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 1,
                "numchild": document.numchild,
                "path": document.path,
                "title": document.title,
                "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": "reader",
            }
        ],
    }
