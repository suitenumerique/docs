"""
Tests for Documents API endpoint in impress's core app: retrieve
"""
# pylint: disable=too-many-lines

import random

from django.contrib.auth.models import AnonymousUser

import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


def test_api_documents_tree_list_anonymous_public_standalone(django_assert_num_queries):
    """Anonymous users should be allowed to retrieve the tree of a public document."""
    parent = factories.DocumentFactory(link_reach="public")
    document, sibling1, sibling2 = factories.DocumentFactory.create_batch(
        3, parent=parent
    )
    child = factories.DocumentFactory(link_reach="public", parent=document)

    with django_assert_num_queries(14):
        APIClient().get(f"/api/v1.0/documents/{document.id!s}/tree/")

    with django_assert_num_queries(4):
        response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/tree/")

    assert response.status_code == 200
    assert response.json() == {
        "abilities": parent.get_abilities(AnonymousUser()),
        "ancestors_link_reach": parent.ancestors_link_reach,
        "ancestors_link_role": parent.ancestors_link_role,
        "children": [
            {
                "abilities": document.get_abilities(AnonymousUser()),
                "children": [
                    {
                        "abilities": child.get_abilities(AnonymousUser()),
                        "ancestors_link_reach": child.ancestors_link_reach,
                        "ancestors_link_role": child.ancestors_link_role,
                        "children": [],
                        "created_at": child.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(child.creator.id),
                        "depth": 3,
                        "excerpt": child.excerpt,
                        "id": str(child.id),
                        "is_favorite": False,
                        "link_reach": child.link_reach,
                        "link_role": child.link_role,
                        "numchild": 0,
                        "nb_accesses_ancestors": 0,
                        "nb_accesses_direct": 0,
                        "path": child.path,
                        "title": child.title,
                        "updated_at": child.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": None,
                    },
                ],
                "ancestors_link_reach": document.ancestors_link_reach,
                "ancestors_link_role": document.ancestors_link_role,
                "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(document.creator.id),
                "depth": 2,
                "excerpt": document.excerpt,
                "id": str(document.id),
                "is_favorite": False,
                "link_reach": document.link_reach,
                "link_role": document.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": document.path,
                "title": document.title,
                "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": sibling1.get_abilities(AnonymousUser()),
                "ancestors_link_reach": sibling1.ancestors_link_reach,
                "ancestors_link_role": sibling1.ancestors_link_role,
                "children": [],
                "created_at": sibling1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(sibling1.creator.id),
                "depth": 2,
                "excerpt": sibling1.excerpt,
                "id": str(sibling1.id),
                "is_favorite": False,
                "link_reach": sibling1.link_reach,
                "link_role": sibling1.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": sibling1.path,
                "title": sibling1.title,
                "updated_at": sibling1.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": sibling2.get_abilities(AnonymousUser()),
                "ancestors_link_reach": sibling2.ancestors_link_reach,
                "ancestors_link_role": sibling2.ancestors_link_role,
                "children": [],
                "created_at": sibling2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(sibling2.creator.id),
                "depth": 2,
                "excerpt": sibling2.excerpt,
                "id": str(sibling2.id),
                "is_favorite": False,
                "link_reach": sibling2.link_reach,
                "link_role": sibling2.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": sibling2.path,
                "title": sibling2.title,
                "updated_at": sibling2.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
        ],
        "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(parent.creator.id),
        "depth": 1,
        "excerpt": parent.excerpt,
        "id": str(parent.id),
        "is_favorite": False,
        "link_reach": parent.link_reach,
        "link_role": parent.link_role,
        "numchild": 3,
        "nb_accesses_ancestors": 0,
        "nb_accesses_direct": 0,
        "path": parent.path,
        "title": parent.title,
        "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": None,
    }


def test_api_documents_tree_list_anonymous_public_parent():
    """
    Anonymous users should be allowed to retrieve the tree of a document who
    has a public ancestor but only up to the highest public ancestor.
    """
    great_grand_parent = factories.DocumentFactory(
        link_reach=random.choice(["authenticated", "restricted"])
    )
    grand_parent = factories.DocumentFactory(
        link_reach="public", parent=great_grand_parent
    )
    factories.DocumentFactory(link_reach="public", parent=great_grand_parent)
    factories.DocumentFactory(
        link_reach=random.choice(["authenticated", "restricted"]),
        parent=great_grand_parent,
    )

    parent = factories.DocumentFactory(
        parent=grand_parent, link_reach=random.choice(["authenticated", "restricted"])
    )
    parent_sibling = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(
        link_reach=random.choice(["authenticated", "restricted"]), parent=parent
    )
    document_sibling = factories.DocumentFactory(parent=parent)
    child = factories.DocumentFactory(link_reach="public", parent=document)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/tree/")

    assert response.status_code == 200
    expected_tree = {
        "abilities": grand_parent.get_abilities(AnonymousUser()),
        "ancestors_link_reach": grand_parent.ancestors_link_reach,
        "ancestors_link_role": grand_parent.ancestors_link_role,
        "children": [
            {
                "abilities": parent.get_abilities(AnonymousUser()),
                "ancestors_link_reach": parent.ancestors_link_reach,
                "ancestors_link_role": parent.ancestors_link_role,
                "children": [
                    {
                        "abilities": document.get_abilities(AnonymousUser()),
                        "ancestors_link_reach": document.ancestors_link_reach,
                        "ancestors_link_role": document.ancestors_link_role,
                        "children": [
                            {
                                "abilities": child.get_abilities(AnonymousUser()),
                                "ancestors_link_reach": child.ancestors_link_reach,
                                "ancestors_link_role": child.ancestors_link_role,
                                "children": [],
                                "created_at": child.created_at.isoformat().replace(
                                    "+00:00", "Z"
                                ),
                                "creator": str(child.creator.id),
                                "depth": 5,
                                "excerpt": child.excerpt,
                                "id": str(child.id),
                                "is_favorite": False,
                                "link_reach": child.link_reach,
                                "link_role": child.link_role,
                                "numchild": 0,
                                "nb_accesses_ancestors": 0,
                                "nb_accesses_direct": 0,
                                "path": child.path,
                                "title": child.title,
                                "updated_at": child.updated_at.isoformat().replace(
                                    "+00:00", "Z"
                                ),
                                "user_role": None,
                            },
                        ],
                        "created_at": document.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(document.creator.id),
                        "depth": 4,
                        "excerpt": document.excerpt,
                        "id": str(document.id),
                        "is_favorite": False,
                        "link_reach": document.link_reach,
                        "link_role": document.link_role,
                        "numchild": 1,
                        "nb_accesses_ancestors": 0,
                        "nb_accesses_direct": 0,
                        "path": document.path,
                        "title": document.title,
                        "updated_at": document.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": None,
                    },
                    {
                        "abilities": document_sibling.get_abilities(AnonymousUser()),
                        "ancestors_link_reach": document.ancestors_link_reach,
                        "ancestors_link_role": document.ancestors_link_role,
                        "children": [],
                        "created_at": document_sibling.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(document_sibling.creator.id),
                        "depth": 4,
                        "excerpt": document_sibling.excerpt,
                        "id": str(document_sibling.id),
                        "is_favorite": False,
                        "link_reach": document_sibling.link_reach,
                        "link_role": document_sibling.link_role,
                        "numchild": 0,
                        "nb_accesses_ancestors": 0,
                        "nb_accesses_direct": 0,
                        "path": document_sibling.path,
                        "title": document_sibling.title,
                        "updated_at": document_sibling.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": None,
                    },
                ],
                "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(parent.creator.id),
                "depth": 3,
                "excerpt": parent.excerpt,
                "id": str(parent.id),
                "is_favorite": False,
                "link_reach": parent.link_reach,
                "link_role": parent.link_role,
                "numchild": 2,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": parent.path,
                "title": parent.title,
                "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": parent_sibling.get_abilities(AnonymousUser()),
                "ancestors_link_reach": parent_sibling.ancestors_link_reach,
                "ancestors_link_role": parent_sibling.ancestors_link_role,
                "children": [],
                "created_at": parent_sibling.created_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "creator": str(parent_sibling.creator.id),
                "depth": 3,
                "excerpt": parent_sibling.excerpt,
                "id": str(parent_sibling.id),
                "is_favorite": False,
                "link_reach": parent_sibling.link_reach,
                "link_role": parent_sibling.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": parent_sibling.path,
                "title": parent_sibling.title,
                "updated_at": parent_sibling.updated_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "user_role": None,
            },
        ],
        "created_at": grand_parent.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(grand_parent.creator.id),
        "depth": 2,
        "excerpt": grand_parent.excerpt,
        "id": str(grand_parent.id),
        "is_favorite": False,
        "link_reach": grand_parent.link_reach,
        "link_role": grand_parent.link_role,
        "numchild": 2,
        "nb_accesses_ancestors": 0,
        "nb_accesses_direct": 0,
        "path": grand_parent.path,
        "title": grand_parent.title,
        "updated_at": grand_parent.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": None,
    }
    assert response.json() == expected_tree


@pytest.mark.parametrize("reach", ["restricted", "authenticated"])
def test_api_documents_tree_list_anonymous_restricted_or_authenticated(reach):
    """
    Anonymous users should not be able to retrieve the tree of a document that is not public.
    """
    parent = factories.DocumentFactory(link_reach=reach)
    document = factories.DocumentFactory(parent=parent, link_reach=reach)
    factories.DocumentFactory(parent=parent)
    factories.DocumentFactory(link_reach="public", parent=document)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/tree/")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_tree_list_authenticated_unrelated_public_or_authenticated(
    reach, django_assert_num_queries
):
    """
    Authenticated users should be able to retrieve the tree of a public/authenticated
    document to which they are not related.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(link_reach=reach)
    document, sibling = factories.DocumentFactory.create_batch(2, parent=parent)
    child = factories.DocumentFactory(link_reach="public", parent=document)

    with django_assert_num_queries(13):
        client.get(f"/api/v1.0/documents/{document.id!s}/tree/")

    with django_assert_num_queries(5):
        response = client.get(f"/api/v1.0/documents/{document.id!s}/tree/")

    assert response.status_code == 200
    assert response.json() == {
        "abilities": parent.get_abilities(user),
        "ancestors_link_reach": None,
        "ancestors_link_role": None,
        "children": [
            {
                "abilities": document.get_abilities(user),
                "ancestors_link_reach": document.ancestors_link_reach,
                "ancestors_link_role": document.ancestors_link_role,
                "children": [
                    {
                        "abilities": child.get_abilities(user),
                        "ancestors_link_reach": child.ancestors_link_reach,
                        "ancestors_link_role": child.ancestors_link_role,
                        "children": [],
                        "created_at": child.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(child.creator.id),
                        "depth": 3,
                        "excerpt": child.excerpt,
                        "id": str(child.id),
                        "is_favorite": False,
                        "link_reach": child.link_reach,
                        "link_role": child.link_role,
                        "numchild": 0,
                        "nb_accesses_ancestors": 0,
                        "nb_accesses_direct": 0,
                        "path": child.path,
                        "title": child.title,
                        "updated_at": child.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": None,
                    },
                ],
                "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(document.creator.id),
                "depth": 2,
                "excerpt": document.excerpt,
                "id": str(document.id),
                "is_favorite": False,
                "link_reach": document.link_reach,
                "link_role": document.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": document.path,
                "title": document.title,
                "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": sibling.get_abilities(user),
                "ancestors_link_reach": sibling.ancestors_link_reach,
                "ancestors_link_role": sibling.ancestors_link_role,
                "children": [],
                "created_at": sibling.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(sibling.creator.id),
                "depth": 2,
                "excerpt": sibling.excerpt,
                "id": str(sibling.id),
                "is_favorite": False,
                "link_reach": sibling.link_reach,
                "link_role": sibling.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": sibling.path,
                "title": sibling.title,
                "updated_at": sibling.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
        ],
        "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(parent.creator.id),
        "depth": 1,
        "excerpt": parent.excerpt,
        "id": str(parent.id),
        "is_favorite": False,
        "link_reach": parent.link_reach,
        "link_role": parent.link_role,
        "numchild": 2,
        "nb_accesses_ancestors": 0,
        "nb_accesses_direct": 0,
        "path": parent.path,
        "title": parent.title,
        "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": None,
    }


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_tree_list_authenticated_public_or_authenticated_parent(
    reach,
):
    """
    Authenticated users should be allowed to retrieve the tree of a document who
    has a public or authenticated ancestor.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    great_grand_parent = factories.DocumentFactory(link_reach="restricted")
    grand_parent = factories.DocumentFactory(
        link_reach=reach, parent=great_grand_parent
    )
    factories.DocumentFactory(
        link_reach=random.choice(["public", "authenticated"]), parent=great_grand_parent
    )
    factories.DocumentFactory(
        link_reach="restricted",
        parent=great_grand_parent,
    )

    parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
    parent_sibling = factories.DocumentFactory(parent=grand_parent)
    document = factories.DocumentFactory(link_reach="restricted", parent=parent)
    document_sibling = factories.DocumentFactory(parent=parent)
    child = factories.DocumentFactory(
        link_reach=random.choice(["public", "authenticated"]), parent=document
    )

    response = client.get(f"/api/v1.0/documents/{document.id!s}/tree/")

    assert response.status_code == 200
    assert response.json() == {
        "abilities": grand_parent.get_abilities(user),
        "ancestors_link_reach": grand_parent.ancestors_link_reach,
        "ancestors_link_role": grand_parent.ancestors_link_role,
        "children": [
            {
                "abilities": parent.get_abilities(user),
                "ancestors_link_reach": parent.ancestors_link_reach,
                "ancestors_link_role": parent.ancestors_link_role,
                "children": [
                    {
                        "abilities": document.get_abilities(user),
                        "ancestors_link_reach": document.ancestors_link_reach,
                        "ancestors_link_role": document.ancestors_link_role,
                        "children": [
                            {
                                "abilities": child.get_abilities(user),
                                "ancestors_link_reach": child.ancestors_link_reach,
                                "ancestors_link_role": child.ancestors_link_role,
                                "children": [],
                                "created_at": child.created_at.isoformat().replace(
                                    "+00:00", "Z"
                                ),
                                "creator": str(child.creator.id),
                                "depth": 5,
                                "excerpt": child.excerpt,
                                "id": str(child.id),
                                "is_favorite": False,
                                "link_reach": child.link_reach,
                                "link_role": child.link_role,
                                "numchild": 0,
                                "nb_accesses_ancestors": 0,
                                "nb_accesses_direct": 0,
                                "path": child.path,
                                "title": child.title,
                                "updated_at": child.updated_at.isoformat().replace(
                                    "+00:00", "Z"
                                ),
                                "user_role": None,
                            },
                        ],
                        "created_at": document.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(document.creator.id),
                        "depth": 4,
                        "excerpt": document.excerpt,
                        "id": str(document.id),
                        "is_favorite": False,
                        "link_reach": document.link_reach,
                        "link_role": document.link_role,
                        "numchild": 1,
                        "nb_accesses_ancestors": 0,
                        "nb_accesses_direct": 0,
                        "path": document.path,
                        "title": document.title,
                        "updated_at": document.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": None,
                    },
                    {
                        "abilities": document_sibling.get_abilities(user),
                        "ancestors_link_reach": document_sibling.ancestors_link_reach,
                        "ancestors_link_role": document_sibling.ancestors_link_role,
                        "children": [],
                        "created_at": document_sibling.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(document_sibling.creator.id),
                        "depth": 4,
                        "excerpt": document_sibling.excerpt,
                        "id": str(document_sibling.id),
                        "is_favorite": False,
                        "link_reach": document_sibling.link_reach,
                        "link_role": document_sibling.link_role,
                        "numchild": 0,
                        "nb_accesses_ancestors": 0,
                        "nb_accesses_direct": 0,
                        "path": document_sibling.path,
                        "title": document_sibling.title,
                        "updated_at": document_sibling.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": None,
                    },
                ],
                "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(parent.creator.id),
                "depth": 3,
                "excerpt": parent.excerpt,
                "id": str(parent.id),
                "is_favorite": False,
                "link_reach": parent.link_reach,
                "link_role": parent.link_role,
                "numchild": 2,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": parent.path,
                "title": parent.title,
                "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": None,
            },
            {
                "abilities": parent_sibling.get_abilities(user),
                "ancestors_link_reach": parent.ancestors_link_reach,
                "ancestors_link_role": parent.ancestors_link_role,
                "children": [],
                "created_at": parent_sibling.created_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "creator": str(parent_sibling.creator.id),
                "depth": 3,
                "excerpt": parent_sibling.excerpt,
                "id": str(parent_sibling.id),
                "is_favorite": False,
                "link_reach": parent_sibling.link_reach,
                "link_role": parent_sibling.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 0,
                "nb_accesses_direct": 0,
                "path": parent_sibling.path,
                "title": parent_sibling.title,
                "updated_at": parent_sibling.updated_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "user_role": None,
            },
        ],
        "created_at": grand_parent.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(grand_parent.creator.id),
        "depth": 2,
        "excerpt": grand_parent.excerpt,
        "id": str(grand_parent.id),
        "is_favorite": False,
        "link_reach": grand_parent.link_reach,
        "link_role": grand_parent.link_role,
        "numchild": 2,
        "nb_accesses_ancestors": 0,
        "nb_accesses_direct": 0,
        "path": grand_parent.path,
        "title": grand_parent.title,
        "updated_at": grand_parent.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": None,
    }


def test_api_documents_tree_list_authenticated_unrelated_restricted():
    """
    Authenticated users should not be allowed to retrieve the tree of a document that is
    restricted and to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(link_reach="restricted")
    document, _sibling = factories.DocumentFactory.create_batch(
        2, link_reach="restricted", parent=parent
    )
    factories.DocumentFactory(link_reach="public", parent=document)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/tree/",
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_tree_list_authenticated_related_direct():
    """
    Authenticated users should be allowed to retrieve the tree of a document
    to which they are directly related whatever the role.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(link_reach="restricted")
    access = factories.UserDocumentAccessFactory(document=parent, user=user)
    factories.UserDocumentAccessFactory(document=parent)

    document, sibling = factories.DocumentFactory.create_batch(2, parent=parent)
    child = factories.DocumentFactory(link_reach="public", parent=document)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/tree/",
    )
    assert response.status_code == 200
    assert response.json() == {
        "abilities": parent.get_abilities(user),
        "ancestors_link_reach": parent.ancestors_link_reach,
        "ancestors_link_role": parent.ancestors_link_role,
        "children": [
            {
                "abilities": document.get_abilities(user),
                "ancestors_link_reach": document.ancestors_link_reach,
                "ancestors_link_role": document.ancestors_link_role,
                "children": [
                    {
                        "abilities": child.get_abilities(user),
                        "ancestors_link_reach": child.ancestors_link_reach,
                        "ancestors_link_role": child.ancestors_link_role,
                        "children": [],
                        "created_at": child.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(child.creator.id),
                        "depth": 3,
                        "excerpt": child.excerpt,
                        "id": str(child.id),
                        "is_favorite": False,
                        "link_reach": child.link_reach,
                        "link_role": child.link_role,
                        "numchild": 0,
                        "nb_accesses_ancestors": 2,
                        "nb_accesses_direct": 0,
                        "path": child.path,
                        "title": child.title,
                        "updated_at": child.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": access.role,
                    },
                ],
                "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(document.creator.id),
                "depth": 2,
                "excerpt": document.excerpt,
                "id": str(document.id),
                "is_favorite": False,
                "link_reach": document.link_reach,
                "link_role": document.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 2,
                "nb_accesses_direct": 0,
                "path": document.path,
                "title": document.title,
                "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
            {
                "abilities": sibling.get_abilities(user),
                "ancestors_link_reach": sibling.ancestors_link_reach,
                "ancestors_link_role": sibling.ancestors_link_role,
                "children": [],
                "created_at": sibling.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(sibling.creator.id),
                "depth": 2,
                "excerpt": sibling.excerpt,
                "id": str(sibling.id),
                "is_favorite": False,
                "link_reach": sibling.link_reach,
                "link_role": sibling.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 2,
                "nb_accesses_direct": 0,
                "path": sibling.path,
                "title": sibling.title,
                "updated_at": sibling.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
        ],
        "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(parent.creator.id),
        "depth": 1,
        "excerpt": parent.excerpt,
        "id": str(parent.id),
        "is_favorite": False,
        "link_reach": parent.link_reach,
        "link_role": parent.link_role,
        "numchild": 2,
        "nb_accesses_ancestors": 2,
        "nb_accesses_direct": 2,
        "path": parent.path,
        "title": parent.title,
        "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": access.role,
    }


def test_api_documents_tree_list_authenticated_related_parent():
    """
    Authenticated users should be allowed to retrieve the tree of a document if they
    are related to one of its ancestors whatever the role.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    great_grand_parent = factories.DocumentFactory(
        link_reach="restricted", link_role="reader"
    )
    grand_parent = factories.DocumentFactory(
        link_reach="restricted", link_role="reader", parent=great_grand_parent
    )
    access = factories.UserDocumentAccessFactory(document=grand_parent, user=user)
    factories.UserDocumentAccessFactory(document=grand_parent)
    factories.DocumentFactory(link_reach="restricted", parent=great_grand_parent)
    factories.DocumentFactory(link_reach="public", parent=great_grand_parent)

    parent = factories.DocumentFactory(
        parent=grand_parent, link_reach="restricted", link_role="reader"
    )
    parent_sibling = factories.DocumentFactory(
        parent=grand_parent, link_reach="restricted", link_role="reader"
    )
    document = factories.DocumentFactory(
        link_reach="restricted", link_role="reader", parent=parent
    )
    document_sibling = factories.DocumentFactory(
        link_reach="restricted", link_role="reader", parent=parent
    )
    child = factories.DocumentFactory(
        link_reach="restricted", link_role="reader", parent=document
    )

    response = client.get(f"/api/v1.0/documents/{document.id!s}/tree/")

    assert response.status_code == 200
    assert response.json() == {
        "abilities": grand_parent.get_abilities(user),
        "ancestors_link_reach": grand_parent.ancestors_link_reach,
        "ancestors_link_role": grand_parent.ancestors_link_role,
        "children": [
            {
                "abilities": parent.get_abilities(user),
                "ancestors_link_reach": parent.ancestors_link_reach,
                "ancestors_link_role": parent.ancestors_link_role,
                "children": [
                    {
                        "abilities": document.get_abilities(user),
                        "ancestors_link_reach": document.ancestors_link_reach,
                        "ancestors_link_role": document.ancestors_link_role,
                        "children": [
                            {
                                "abilities": child.get_abilities(user),
                                "ancestors_link_reach": child.ancestors_link_reach,
                                "ancestors_link_role": child.ancestors_link_role,
                                "children": [],
                                "created_at": child.created_at.isoformat().replace(
                                    "+00:00", "Z"
                                ),
                                "creator": str(child.creator.id),
                                "depth": 5,
                                "excerpt": child.excerpt,
                                "id": str(child.id),
                                "is_favorite": False,
                                "link_reach": child.link_reach,
                                "link_role": child.link_role,
                                "numchild": 0,
                                "nb_accesses_ancestors": 2,
                                "nb_accesses_direct": 0,
                                "path": child.path,
                                "title": child.title,
                                "updated_at": child.updated_at.isoformat().replace(
                                    "+00:00", "Z"
                                ),
                                "user_role": access.role,
                            },
                        ],
                        "created_at": document.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(document.creator.id),
                        "depth": 4,
                        "excerpt": document.excerpt,
                        "id": str(document.id),
                        "is_favorite": False,
                        "link_reach": document.link_reach,
                        "link_role": document.link_role,
                        "numchild": 1,
                        "nb_accesses_ancestors": 2,
                        "nb_accesses_direct": 0,
                        "path": document.path,
                        "title": document.title,
                        "updated_at": document.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": access.role,
                    },
                    {
                        "abilities": document_sibling.get_abilities(user),
                        "ancestors_link_reach": document_sibling.ancestors_link_reach,
                        "ancestors_link_role": document_sibling.ancestors_link_role,
                        "children": [],
                        "created_at": document_sibling.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(document_sibling.creator.id),
                        "depth": 4,
                        "excerpt": document_sibling.excerpt,
                        "id": str(document_sibling.id),
                        "is_favorite": False,
                        "link_reach": document_sibling.link_reach,
                        "link_role": document_sibling.link_role,
                        "numchild": 0,
                        "nb_accesses_ancestors": 2,
                        "nb_accesses_direct": 0,
                        "path": document_sibling.path,
                        "title": document_sibling.title,
                        "updated_at": document_sibling.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": access.role,
                    },
                ],
                "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(parent.creator.id),
                "depth": 3,
                "excerpt": parent.excerpt,
                "id": str(parent.id),
                "is_favorite": False,
                "link_reach": parent.link_reach,
                "link_role": parent.link_role,
                "numchild": 2,
                "nb_accesses_ancestors": 2,
                "nb_accesses_direct": 0,
                "path": parent.path,
                "title": parent.title,
                "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
            {
                "abilities": parent_sibling.get_abilities(user),
                "ancestors_link_reach": parent_sibling.ancestors_link_reach,
                "ancestors_link_role": parent_sibling.ancestors_link_role,
                "children": [],
                "created_at": parent_sibling.created_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "creator": str(parent_sibling.creator.id),
                "depth": 3,
                "excerpt": parent_sibling.excerpt,
                "id": str(parent_sibling.id),
                "is_favorite": False,
                "link_reach": parent_sibling.link_reach,
                "link_role": parent_sibling.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 2,
                "nb_accesses_direct": 0,
                "path": parent_sibling.path,
                "title": parent_sibling.title,
                "updated_at": parent_sibling.updated_at.isoformat().replace(
                    "+00:00", "Z"
                ),
                "user_role": access.role,
            },
        ],
        "created_at": grand_parent.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(grand_parent.creator.id),
        "depth": 2,
        "excerpt": grand_parent.excerpt,
        "id": str(grand_parent.id),
        "is_favorite": False,
        "link_reach": grand_parent.link_reach,
        "link_role": grand_parent.link_role,
        "numchild": 2,
        "nb_accesses_ancestors": 2,
        "nb_accesses_direct": 2,
        "path": grand_parent.path,
        "title": grand_parent.title,
        "updated_at": grand_parent.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": access.role,
    }


def test_api_documents_tree_list_authenticated_related_team_none(mock_user_teams):
    """
    Authenticated users should not be able to retrieve the tree of a restricted document
    related to teams in which the user is not.
    """
    mock_user_teams.return_value = []

    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(link_reach="restricted")
    document, _sibling = factories.DocumentFactory.create_batch(
        2, link_reach="restricted", parent=parent
    )
    factories.DocumentFactory(link_reach="public", parent=document)

    factories.TeamDocumentAccessFactory(document=document, team="myteam")

    response = client.get(f"/api/v1.0/documents/{document.id!s}/tree/")
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_tree_list_authenticated_related_team_members(
    mock_user_teams,
):
    """
    Authenticated users should be allowed to retrieve the tree of a document to which they
    are related via a team whatever the role.
    """
    mock_user_teams.return_value = ["myteam"]

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent = factories.DocumentFactory(link_reach="restricted")
    document, sibling = factories.DocumentFactory.create_batch(
        2, link_reach="restricted", parent=parent
    )
    child = factories.DocumentFactory(link_reach="public", parent=document)

    access = factories.TeamDocumentAccessFactory(document=parent, team="myteam")
    factories.TeamDocumentAccessFactory(document=parent, team="another-team")

    response = client.get(f"/api/v1.0/documents/{document.id!s}/tree/")

    # pylint: disable=R0801
    assert response.status_code == 200
    assert response.json() == {
        "abilities": parent.get_abilities(user),
        "ancestors_link_reach": None,
        "ancestors_link_role": None,
        "children": [
            {
                "abilities": document.get_abilities(user),
                "ancestors_link_reach": "restricted",
                "ancestors_link_role": None,
                "children": [
                    {
                        "abilities": child.get_abilities(user),
                        "ancestors_link_reach": "restricted",
                        "ancestors_link_role": None,
                        "children": [],
                        "created_at": child.created_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "creator": str(child.creator.id),
                        "depth": 3,
                        "excerpt": child.excerpt,
                        "id": str(child.id),
                        "is_favorite": False,
                        "link_reach": child.link_reach,
                        "link_role": child.link_role,
                        "numchild": 0,
                        "nb_accesses_ancestors": 2,
                        "nb_accesses_direct": 0,
                        "path": child.path,
                        "title": child.title,
                        "updated_at": child.updated_at.isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "user_role": access.role,
                    },
                ],
                "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(document.creator.id),
                "depth": 2,
                "excerpt": document.excerpt,
                "id": str(document.id),
                "is_favorite": False,
                "link_reach": document.link_reach,
                "link_role": document.link_role,
                "numchild": 1,
                "nb_accesses_ancestors": 2,
                "nb_accesses_direct": 0,
                "path": document.path,
                "title": document.title,
                "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
            {
                "abilities": sibling.get_abilities(user),
                "ancestors_link_reach": "restricted",
                "ancestors_link_role": None,
                "children": [],
                "created_at": sibling.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(sibling.creator.id),
                "depth": 2,
                "excerpt": sibling.excerpt,
                "id": str(sibling.id),
                "is_favorite": False,
                "link_reach": sibling.link_reach,
                "link_role": sibling.link_role,
                "numchild": 0,
                "nb_accesses_ancestors": 2,
                "nb_accesses_direct": 0,
                "path": sibling.path,
                "title": sibling.title,
                "updated_at": sibling.updated_at.isoformat().replace("+00:00", "Z"),
                "user_role": access.role,
            },
        ],
        "created_at": parent.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(parent.creator.id),
        "depth": 1,
        "excerpt": parent.excerpt,
        "id": str(parent.id),
        "is_favorite": False,
        "link_reach": parent.link_reach,
        "link_role": parent.link_role,
        "numchild": 2,
        "nb_accesses_ancestors": 2,
        "nb_accesses_direct": 2,
        "path": parent.path,
        "title": parent.title,
        "updated_at": parent.updated_at.isoformat().replace("+00:00", "Z"),
        "user_role": access.role,
    }
