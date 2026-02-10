"""
Tests for search API endpoint in impress's core app when indexer is not
available and a path param is given.
"""

import random

from django.contrib.auth.models import AnonymousUser

import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def disable_indexer(indexer_settings):
    """Disable search indexer for all tests in this file."""
    indexer_settings.SEARCH_INDEXER_CLASS = None


def test_api_documents_descendants_list_anonymous_public_standalone(indexer_settings):
    """Anonymous users should be allowed to retrieve the descendants of a public document."""
    document = factories.DocumentFactory(link_reach="public", title="doc parent")
    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document, title="doc child")
    grand_child = factories.DocumentFactory(parent=child1, title="doc grand child")

    factories.UserDocumentAccessFactory(document=child1)

    response = APIClient().get(
        "/api/v1.0/documents/search/",
        data={"q": "doc", "path": document.path}
    )

    assert response.status_code == 200
    assert response.json() == {
        "count": 4,
        "next": None,
        "previous": None,
        "results": [
            {
                # the search should include the parent document itself
                "abilities": document.get_abilities(AnonymousUser()),
                "ancestors_link_reach": None,
                "ancestors_link_role": None,
                "computed_link_reach": "public",
                "computed_link_role": document.computed_link_role,
                "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(document.creator.id),
                "deleted_at": None,
                "depth": 1,
                "excerpt": document.excerpt,
                "id": str(document.id),
                "is_favorite": False,
                "link_reach": document.link_reach,
                "link_role": document.link_role,
                "numchild": 2,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": document.path,
                "title": document.title,
                "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": child1.get_abilities(AnonymousUser()),
                "ancestors_link_reach": "public",
                "ancestors_link_role": document.link_role,
                "computed_link_reach": child1.computed_link_reach,
                "computed_link_role": child1.computed_link_role,
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child1.excerpt,
                "id": str(child1.id),
                "is_favorite": False,
                "link_reach": child1.link_reach,
                "link_role": child1.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 1,
                "path": child1.path,
                "title": child1.title,
                "updated_at": child1.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": grand_child.get_abilities(AnonymousUser()),
                "ancestors_link_reach": "public",
                "ancestors_link_role": "editor"
                if (child1.link_reach == "public" and child1.link_role == "editor")
                else document.link_role,
                "computed_link_reach": "public",
                "computed_link_role": grand_child.computed_link_role,
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
                "deleted_at": None,
                "depth": 3,
                "excerpt": grand_child.excerpt,
                "id": str(grand_child.id),
                "is_favorite": False,
                "link_reach": grand_child.link_reach,
                "link_role": grand_child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 0,
                "path": grand_child.path,
                "title": grand_child.title,
                "updated_at": grand_child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": child2.get_abilities(AnonymousUser()),
                "ancestors_link_reach": "public",
                "ancestors_link_role": document.link_role,
                "computed_link_reach": "public",
                "computed_link_role": child2.computed_link_role,
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child2.excerpt,
                "id": str(child2.id),
                "is_favorite": False,
                "link_reach": child2.link_reach,
                "link_role": child2.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": child2.path,
                "title": child2.title,
                "updated_at": child2.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
        ],
    }


def test_api_documents_descendants_list_anonymous_public_parent(indexer_settings):
    """
    Anonymous users should be allowed to retrieve the descendants of a document who
    has a public ancestor.
    """
    grand_parent = factories.DocumentFactory(link_reach="public", title="grand parent doc")
    parent = factories.DocumentFactory(
        parent=grand_parent, link_reach=random.choice(["authenticated", "restricted"]), title="parent doc"
    )
    document = factories.DocumentFactory(
        link_reach=random.choice(["authenticated", "restricted"]), parent=parent, title="document"
    )
    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document, title="child doc")
    grand_child = factories.DocumentFactory(parent=child1, title="grand child doc")

    factories.UserDocumentAccessFactory(document=child1)

    response = APIClient().get(
        "/api/v1.0/documents/search/",
        data={"q": "doc", "path": document.path}
    )

    assert response.status_code == 200
    assert response.json() == {
        "count": 4,
        "next": None,
        "previous": None,
        "results": [
            {
                # the search should include the parent document itself
                "abilities": document.get_abilities(AnonymousUser()),
                "ancestors_link_reach": "public",
                "ancestors_link_role": grand_parent.link_role,
                "computed_link_reach":  document.computed_link_reach,
                "computed_link_role": document.computed_link_role,
                "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(document.creator.id),
                "deleted_at": None,
                "depth": 3,
                "excerpt": document.excerpt,
                "id": str(document.id),
                "is_favorite": False,
                "link_reach": document.link_reach,
                "link_role": document.link_role,
                "numchild": 2,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": document.path,
                "title": document.title,
                "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": child1.get_abilities(AnonymousUser()),
                "ancestors_link_reach": "public",
                "ancestors_link_role": grand_parent.link_role,
                "computed_link_reach": child1.computed_link_reach,
                "computed_link_role": child1.computed_link_role,
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
                "deleted_at": None,
                "depth": 4,
                "excerpt": child1.excerpt,
                "id": str(child1.id),
                "is_favorite": False,
                "link_reach": child1.link_reach,
                "link_role": child1.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 1,
                "path": child1.path,
                "title": child1.title,
                "updated_at": child1.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": grand_child.get_abilities(AnonymousUser()),
                "ancestors_link_reach": "public",
                "ancestors_link_role": grand_child.ancestors_link_role,
                "computed_link_reach": "public",
                "computed_link_role": grand_child.computed_link_role,
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
                "deleted_at": None,
                "depth": 5,
                "excerpt": grand_child.excerpt,
                "id": str(grand_child.id),
                "is_favorite": False,
                "link_reach": grand_child.link_reach,
                "link_role": grand_child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 0,
                "path": grand_child.path,
                "title": grand_child.title,
                "updated_at": grand_child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": child2.get_abilities(AnonymousUser()),
                "ancestors_link_reach": "public",
                "ancestors_link_role": grand_parent.link_role,
                "computed_link_reach": "public",
                "computed_link_role": child2.computed_link_role,
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
                "deleted_at": None,
                "depth": 4,
                "excerpt": child2.excerpt,
                "id": str(child2.id),
                "is_favorite": False,
                "link_reach": child2.link_reach,
                "link_role": child2.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": child2.path,
                "title": child2.title,
                "updated_at": child2.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
        ],
    }


@pytest.mark.parametrize("reach", ["restricted", "authenticated"])
def test_api_documents_descendants_list_anonymous_restricted_or_authenticated(reach, indexer_settings):
    """
    Anonymous users should not be able to retrieve descendants of a document that is not public.
    """
    document = factories.DocumentFactory(title="parent", link_reach=reach)
    child = factories.DocumentFactory(title="child", parent=document)
    _grand_child = factories.DocumentFactory(title="grand child", parent=child)

    response = APIClient().get(
        "/api/v1.0/documents/search/",
        data={"q": "doc", "path": document.path}
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_descendants_list_authenticated_unrelated_public_or_authenticated(
    reach, indexer_settings
):
    """
    Authenticated users should be able to retrieve the descendants of a public/authenticated
    document to which they are not related.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, title="parent")
    child1, child2 = factories.DocumentFactory.create_batch(
        2, parent=document, link_reach="restricted", title="child"
    )
    grand_child = factories.DocumentFactory(parent=child1, title="grand child")

    factories.UserDocumentAccessFactory(document=child1)

    response = client.get(
        "/api/v1.0/documents/search/",
        data={"q": "child", "path": document.path}
    )

    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": child1.get_abilities(user),
                "ancestors_link_reach": reach,
                "ancestors_link_role": document.link_role,
                "computed_link_reach": child1.computed_link_reach,
                "computed_link_role": child1.computed_link_role,
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child1.excerpt,
                "id": str(child1.id),
                "is_favorite": False,
                "link_reach": child1.link_reach,
                "link_role": child1.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 1,
                "path": child1.path,
                "title": child1.title,
                "updated_at": child1.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": grand_child.get_abilities(user),
                "ancestors_link_reach": reach,
                "ancestors_link_role": document.link_role,
                "computed_link_reach": grand_child.computed_link_reach,
                "computed_link_role": grand_child.computed_link_role,
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
                "deleted_at": None,
                "depth": 3,
                "excerpt": grand_child.excerpt,
                "id": str(grand_child.id),
                "is_favorite": False,
                "link_reach": grand_child.link_reach,
                "link_role": grand_child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 0,
                "path": grand_child.path,
                "title": grand_child.title,
                "updated_at": grand_child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": child2.get_abilities(user),
                "ancestors_link_reach": reach,
                "ancestors_link_role": document.link_role,
                "computed_link_reach": child2.computed_link_reach,
                "computed_link_role": child2.computed_link_role,
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child2.excerpt,
                "id": str(child2.id),
                "is_favorite": False,
                "link_reach": child2.link_reach,
                "link_role": child2.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": child2.path,
                "title": child2.title,
                "updated_at": child2.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
        ],
    }


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_descendants_list_authenticated_public_or_authenticated_parent(
    reach, indexer_settings
):
    """
    Authenticated users should be allowed to retrieve the descendants of a document who
    has a public or authenticated ancestor.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory(link_reach=reach, title="grand parent")
    parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted", title="parent")
    document = factories.DocumentFactory(link_reach="restricted", parent=parent, title="document")
    child1, child2 = factories.DocumentFactory.create_batch(
        2, parent=document, link_reach="restricted", title="child"
    )
    grand_child = factories.DocumentFactory(parent=child1, title="grand child")

    factories.UserDocumentAccessFactory(document=child1)

    response = client.get(
        "/api/v1.0/documents/search/",
        data={"q": "child", "path": document.path}
    )

    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": child1.get_abilities(user),
                "ancestors_link_reach": reach,
                "ancestors_link_role": grand_parent.link_role,
                "computed_link_reach": child1.computed_link_reach,
                "computed_link_role": child1.computed_link_role,
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
                "deleted_at": None,
                "depth": 4,
                "excerpt": child1.excerpt,
                "id": str(child1.id),
                "is_favorite": False,
                "link_reach": child1.link_reach,
                "link_role": child1.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 1,
                "path": child1.path,
                "title": child1.title,
                "updated_at": child1.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": grand_child.get_abilities(user),
                "ancestors_link_reach": reach,
                "ancestors_link_role": grand_parent.link_role,
                "computed_link_reach": grand_child.computed_link_reach,
                "computed_link_role": grand_child.computed_link_role,
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
                "deleted_at": None,
                "depth": 5,
                "excerpt": grand_child.excerpt,
                "id": str(grand_child.id),
                "is_favorite": False,
                "link_reach": grand_child.link_reach,
                "link_role": grand_child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 0,
                "path": grand_child.path,
                "title": grand_child.title,
                "updated_at": grand_child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": child2.get_abilities(user),
                "ancestors_link_reach": reach,
                "ancestors_link_role": grand_parent.link_role,
                "computed_link_reach": child2.computed_link_reach,
                "computed_link_role": child2.computed_link_role,
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
                "deleted_at": None,
                "depth": 4,
                "excerpt": child2.excerpt,
                "id": str(child2.id),
                "is_favorite": False,
                "link_reach": child2.link_reach,
                "link_role": child2.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": child2.path,
                "title": child2.title,
                "updated_at": child2.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
        ],
    }


def test_api_documents_descendants_list_authenticated_unrelated_restricted(indexer_settings):
    """
    Authenticated users should not be allowed to retrieve the descendants of a document that is
    restricted and to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted", title="parent")
    child1, _child2 = factories.DocumentFactory.create_batch(2, parent=document, title="child")
    _grand_child = factories.DocumentFactory(parent=child1, title="grand child")

    factories.UserDocumentAccessFactory(document=child1)

    response = client.get(
        "/api/v1.0/documents/search/",
        data={"q": "child", "path": document.path}
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_descendants_list_authenticated_related_direct(indexer_settings):
    """
    Authenticated users should be allowed to retrieve the descendants of a document
    to which they are directly related whatever the role.
    """
    indexer_settings.SEARCH_INDEXER_QUERY_URL = None

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(title="parent")
    access = factories.UserDocumentAccessFactory(document=document, user=user)
    factories.UserDocumentAccessFactory(document=document)

    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document, title="child")
    factories.UserDocumentAccessFactory(document=child1)

    grand_child = factories.DocumentFactory(parent=child1, title="grand child")

    response = client.get(
        "/api/v1.0/documents/search/",
        data={"q": "child", "path": document.path}
    )
    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": child1.get_abilities(user),
                "ancestors_link_reach": child1.ancestors_link_reach,
                "ancestors_link_role": child1.ancestors_link_role,
                "computed_link_reach": child1.computed_link_reach,
                "computed_link_role": child1.computed_link_role,
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child1.excerpt,
                "id": str(child1.id),
                "is_favorite": False,
                "link_reach": child1.link_reach,
                "link_role": child1.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 3,
                "nb_accesses_direct": 1,
                "path": child1.path,
                "title": child1.title,
                "updated_at": child1.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
            {
                "abilities": grand_child.get_abilities(user),
                "ancestors_link_reach": grand_child.ancestors_link_reach,
                "ancestors_link_role": grand_child.ancestors_link_role,
                "computed_link_reach": grand_child.computed_link_reach,
                "computed_link_role": grand_child.computed_link_role,
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
                "deleted_at": None,
                "depth": 3,
                "excerpt": grand_child.excerpt,
                "id": str(grand_child.id),
                "is_favorite": False,
                "link_reach": grand_child.link_reach,
                "link_role": grand_child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 3,
                "nb_accesses_direct": 0,
                "path": grand_child.path,
                "title": grand_child.title,
                "updated_at": grand_child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
            {
                "abilities": child2.get_abilities(user),
                "ancestors_link_reach": child2.ancestors_link_reach,
                "ancestors_link_role": child2.ancestors_link_role,
                "computed_link_reach": child2.computed_link_reach,
                "computed_link_role": child2.computed_link_role,
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child2.excerpt,
                "id": str(child2.id),
                "is_favorite": False,
                "link_reach": child2.link_reach,
                "link_role": child2.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 2,
                "nb_accesses_direct": 0,
                "path": child2.path,
                "title": child2.title,
                "updated_at": child2.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
        ],
    }


def test_api_documents_descendants_list_authenticated_related_parent(indexer_settings):
    """
    Authenticated users should be allowed to retrieve the descendants of a document if they
    are related to one of its ancestors whatever the role.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory(link_reach="restricted", title="parent")
    grand_parent_access = factories.UserDocumentAccessFactory(
        document=grand_parent, user=user
    )

    parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted", title="parent")
    document = factories.DocumentFactory(parent=parent, link_reach="restricted", title="document")

    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document, title="child")
    factories.UserDocumentAccessFactory(document=child1)

    grand_child = factories.DocumentFactory(parent=child1, title="grand child")

    response = client.get(
        "/api/v1.0/documents/search/",
        data={"q": "child", "path": document.path}
    )
    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": child1.get_abilities(user),
                "ancestors_link_reach": child1.ancestors_link_reach,
                "ancestors_link_role": child1.ancestors_link_role,
                "computed_link_reach": child1.computed_link_reach,
                "computed_link_role": child1.computed_link_role,
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
                "deleted_at": None,
                "depth": 4,
                "excerpt": child1.excerpt,
                "id": str(child1.id),
                "is_favorite": False,
                "link_reach": child1.link_reach,
                "link_role": child1.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 2,
                "nb_accesses_direct": 1,
                "path": child1.path,
                "title": child1.title,
                "updated_at": child1.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": grand_parent_access.role,
            },
            {
                "abilities": grand_child.get_abilities(user),
                "ancestors_link_reach": grand_child.ancestors_link_reach,
                "ancestors_link_role": grand_child.ancestors_link_role,
                "computed_link_reach": grand_child.computed_link_reach,
                "computed_link_role": grand_child.computed_link_role,
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
                "deleted_at": None,
                "depth": 5,
                "excerpt": grand_child.excerpt,
                "id": str(grand_child.id),
                "is_favorite": False,
                "link_reach": grand_child.link_reach,
                "link_role": grand_child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 2,
                "nb_accesses_direct": 0,
                "path": grand_child.path,
                "title": grand_child.title,
                "updated_at": grand_child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": grand_parent_access.role,
            },
            {
                "abilities": child2.get_abilities(user),
                "ancestors_link_reach": child2.ancestors_link_reach,
                "ancestors_link_role": child2.ancestors_link_role,
                "computed_link_reach": child2.computed_link_reach,
                "computed_link_role": child2.computed_link_role,
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
                "deleted_at": None,
                "depth": 4,
                "excerpt": child2.excerpt,
                "id": str(child2.id),
                "is_favorite": False,
                "link_reach": child2.link_reach,
                "link_role": child2.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 0,
                "path": child2.path,
                "title": child2.title,
                "updated_at": child2.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": grand_parent_access.role,
            },
        ],
    }


def test_api_documents_descendants_list_authenticated_related_child(indexer_settings):
    """
    Authenticated users should not be allowed to retrieve all the descendants of a document
    as a result of being related to one of its children.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    child1, _child2 = factories.DocumentFactory.create_batch(2, parent=document)
    _grand_child = factories.DocumentFactory(parent=child1)

    factories.UserDocumentAccessFactory(document=child1, user=user)
    factories.UserDocumentAccessFactory(document=document)

    response = client.get(
        "/api/v1.0/documents/search/",
        data={"q": "doc", "path": document.path}
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_descendants_list_authenticated_related_team_none(
    mock_user_teams, indexer_settings
):
    """
    Authenticated users should not be able to retrieve the descendants of a restricted document
    related to teams in which the user is not.
    """
    indexer_settings.SEARCH_INDEXER_QUERY_URL = None

    mock_user_teams.return_value = []

    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted", title="document")
    factories.DocumentFactory.create_batch(2, parent=document, title="child")

    factories.TeamDocumentAccessFactory(document=document, team="myteam")

    response = client.get(
        "/api/v1.0/documents/search/",
        data={"q": "doc", "path": document.path}
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_descendants_list_authenticated_related_team_members(
    mock_user_teams, indexer_settings
):
    """
    Authenticated users should be allowed to retrieve the descendants of a document to which they
    are related via a team whatever the role.
    """
    mock_user_teams.return_value = ["myteam"]

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted", title="parent")
    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document, title="child")
    grand_child = factories.DocumentFactory(parent=child1, title="grand child")

    access = factories.TeamDocumentAccessFactory(document=document, team="myteam")

    response = client.get(
        "/api/v1.0/documents/search/",
        data={"q": "child", "path": document.path}
    )

    # pylint: disable=R0801
    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": child1.get_abilities(user),
                "ancestors_link_reach": child1.ancestors_link_reach,
                "ancestors_link_role": child1.ancestors_link_role,
                "computed_link_reach": child1.computed_link_reach,
                "computed_link_role": child1.computed_link_role,
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child1.excerpt,
                "id": str(child1.id),
                "is_favorite": False,
                "link_reach": child1.link_reach,
                "link_role": child1.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 0,
                "path": child1.path,
                "title": child1.title,
                "updated_at": child1.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
            {
                "abilities": grand_child.get_abilities(user),
                "ancestors_link_reach": grand_child.ancestors_link_reach,
                "ancestors_link_role": grand_child.ancestors_link_role,
                "computed_link_reach": grand_child.computed_link_reach,
                "computed_link_role": grand_child.computed_link_role,
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
                "deleted_at": None,
                "depth": 3,
                "excerpt": grand_child.excerpt,
                "id": str(grand_child.id),
                "is_favorite": False,
                "link_reach": grand_child.link_reach,
                "link_role": grand_child.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 0,
                "path": grand_child.path,
                "title": grand_child.title,
                "updated_at": grand_child.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
            {
                "abilities": child2.get_abilities(user),
                "ancestors_link_reach": child2.ancestors_link_reach,
                "ancestors_link_role": child2.ancestors_link_role,
                "computed_link_reach": child2.computed_link_reach,
                "computed_link_role": child2.computed_link_role,
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
                "deleted_at": None,
                "depth": 2,
                "excerpt": child2.excerpt,
                "id": str(child2.id),
                "is_favorite": False,
                "link_reach": child2.link_reach,
                "link_role": child2.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 1,
                "nb_accesses_direct": 0,
                "path": child2.path,
                "title": child2.title,
                "updated_at": child2.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
        ],
    }
