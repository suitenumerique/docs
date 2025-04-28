"""
Tests for Documents API endpoint in impress's core app: descendants
"""

import random

from django.contrib.auth.models import AnonymousUser

import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


def test_api_documents_descendants_list_anonymous_public_standalone():
    """Anonymous users should be allowed to retrieve the descendants of a public document."""
    document = factories.DocumentFactory(link_reach="public")
    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document)
    grand_child = factories.DocumentFactory(parent=child1)

    factories.UserDocumentAccessFactory(document=child1)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/descendants/")

    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": child1.get_abilities(AnonymousUser()),
                "ancestors_link_reach": "public",
                "ancestors_link_role": document.link_role,
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
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
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
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
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
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


def test_api_documents_descendants_list_anonymous_public_parent():
    """
    Anonymous users should be allowed to retrieve the descendants of a document who
    has a public ancestor.
    """
    grand_parent = factories.DocumentFactory(link_reach="public")
    parent = factories.DocumentFactory(
        parent=grand_parent, link_reach=random.choice(["authenticated", "restricted"])
    )
    document = factories.DocumentFactory(
        link_reach=random.choice(["authenticated", "restricted"]), parent=parent
    )
    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document)
    grand_child = factories.DocumentFactory(parent=child1)

    factories.UserDocumentAccessFactory(document=child1)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/descendants/")

    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "abilities": child1.get_abilities(AnonymousUser()),
                "ancestors_link_reach": "public",
                "ancestors_link_role": grand_parent.link_role,
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
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
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
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
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
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
def test_api_documents_descendants_list_anonymous_restricted_or_authenticated(reach):
    """
    Anonymous users should not be able to retrieve descendants of a document that is not public.
    """
    document = factories.DocumentFactory(link_reach=reach)
    child = factories.DocumentFactory(parent=document)
    _grand_child = factories.DocumentFactory(parent=child)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/descendants/")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_descendants_list_authenticated_unrelated_public_or_authenticated(
    reach,
):
    """
    Authenticated users should be able to retrieve the descendants of a public/authenticated
    document to which they are not related.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)
    child1, child2 = factories.DocumentFactory.create_batch(
        2, parent=document, link_reach="restricted"
    )
    grand_child = factories.DocumentFactory(parent=child1)

    factories.UserDocumentAccessFactory(document=child1)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/descendants/",
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
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
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
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
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
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
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
    reach,
):
    """
    Authenticated users should be allowed to retrieve the descendants of a document who
    has a public or authenticated ancestor.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory(link_reach=reach)
    parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
    document = factories.DocumentFactory(link_reach="restricted", parent=parent)
    child1, child2 = factories.DocumentFactory.create_batch(
        2, parent=document, link_reach="restricted"
    )
    grand_child = factories.DocumentFactory(parent=child1)

    factories.UserDocumentAccessFactory(document=child1)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/descendants/")

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
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
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
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
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
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
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


def test_api_documents_descendants_list_authenticated_unrelated_restricted():
    """
    Authenticated users should not be allowed to retrieve the descendants of a document that is
    restricted and to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    child1, _child2 = factories.DocumentFactory.create_batch(2, parent=document)
    _grand_child = factories.DocumentFactory(parent=child1)

    factories.UserDocumentAccessFactory(document=child1)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/descendants/",
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_descendants_list_authenticated_related_direct():
    """
    Authenticated users should be allowed to retrieve the descendants of a document
    to which they are directly related whatever the role.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    access = factories.UserDocumentAccessFactory(document=document, user=user)
    factories.UserDocumentAccessFactory(document=document)

    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document)
    factories.UserDocumentAccessFactory(document=child1)

    grand_child = factories.DocumentFactory(parent=child1)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/descendants/",
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
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
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
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
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
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
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


def test_api_documents_descendants_list_authenticated_related_parent():
    """
    Authenticated users should be allowed to retrieve the descendants of a document if they
    are related to one of its ancestors whatever the role.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory(link_reach="restricted")
    grand_parent_access = factories.UserDocumentAccessFactory(
        document=grand_parent, user=user
    )

    parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
    document = factories.DocumentFactory(parent=parent, link_reach="restricted")

    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document)
    factories.UserDocumentAccessFactory(document=child1)

    grand_child = factories.DocumentFactory(parent=child1)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/descendants/",
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
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
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
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
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
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
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


def test_api_documents_descendants_list_authenticated_related_child():
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
        f"/api/v1.0/documents/{document.id!s}/descendants/",
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_descendants_list_authenticated_related_team_none(
    mock_user_teams,
):
    """
    Authenticated users should not be able to retrieve the descendants of a restricted document
    related to teams in which the user is not.
    """
    mock_user_teams.return_value = []

    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    factories.DocumentFactory.create_batch(2, parent=document)

    factories.TeamDocumentAccessFactory(document=document, team="myteam")

    response = client.get(f"/api/v1.0/documents/{document.id!s}/descendants/")
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_descendants_list_authenticated_related_team_members(
    mock_user_teams,
):
    """
    Authenticated users should be allowed to retrieve the descendants of a document to which they
    are related via a team whatever the role.
    """
    mock_user_teams.return_value = ["myteam"]

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    child1, child2 = factories.DocumentFactory.create_batch(2, parent=document)
    grand_child = factories.DocumentFactory(parent=child1)

    access = factories.TeamDocumentAccessFactory(document=document, team="myteam")

    response = client.get(f"/api/v1.0/documents/{document.id!s}/descendants/")

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
                "created_at": child1.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child1.creator.id),
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
                "created_at": grand_child.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(grand_child.creator.id),
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
                "created_at": child2.created_at.isoformat().replace("+00:00", "Z"),
                "creator": str(child2.creator.id),
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
