"""
Tests for Documents API endpoint in impress's core app: retrieve
"""

import random

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_api_documents_retrieve_anonymous_public_standalone():
    """Anonymous users should be allowed to retrieve public documents."""
    document = factories.DocumentFactory(link_reach="public")

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 200
    assert response.json() == {
        "id": str(document.id),
        "abilities": {
            "accesses_manage": False,
            "accesses_view": False,
            "ai_transform": document.link_role == "editor",
            "ai_translate": document.link_role == "editor",
            "attachment_upload": document.link_role == "editor",
            "children_create": False,
            "children_list": True,
            "collaboration_auth": True,
            "destroy": False,
            # Anonymous user can't favorite a document even with read access
            "favorite": False,
            "invite_owner": False,
            "link_configuration": False,
            "media_auth": True,
            "move": False,
            "partial_update": document.link_role == "editor",
            "retrieve": True,
            "update": document.link_role == "editor",
            "versions_destroy": False,
            "versions_list": False,
            "versions_retrieve": False,
        },
        "content": document.content,
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 1,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "link_reach": "public",
        "link_role": document.link_role,
        "nb_accesses": 0,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_roles": [],
    }


def test_api_documents_retrieve_anonymous_public_parent():
    """Anonymous users should be allowed to retrieve a document who has a public ancestor."""
    grand_parent = factories.DocumentFactory(link_reach="public")
    parent = factories.DocumentFactory(
        parent=grand_parent, link_reach=random.choice(["authenticated", "restricted"])
    )
    document = factories.DocumentFactory(
        link_reach=random.choice(["authenticated", "restricted"]), parent=parent
    )

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 200
    assert response.json() == {
        "id": str(document.id),
        "abilities": {
            "accesses_manage": False,
            "accesses_view": False,
            "ai_transform": grand_parent.link_role == "editor",
            "ai_translate": grand_parent.link_role == "editor",
            "attachment_upload": grand_parent.link_role == "editor",
            "children_create": False,
            "children_list": True,
            "collaboration_auth": True,
            "destroy": False,
            # Anonymous user can't favorite a document even with read access
            "favorite": False,
            "invite_owner": False,
            "link_configuration": False,
            "media_auth": True,
            "move": False,
            "partial_update": grand_parent.link_role == "editor",
            "retrieve": True,
            "update": grand_parent.link_role == "editor",
            "versions_destroy": False,
            "versions_list": False,
            "versions_retrieve": False,
        },
        "content": document.content,
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 3,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "link_reach": document.link_reach,
        "link_role": document.link_role,
        "nb_accesses": 0,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_roles": [],
    }


def test_api_documents_retrieve_anonymous_public_child():
    """
    Anonymous users having access to a document should not gain access to a parent document.
    """
    document = factories.DocumentFactory(
        link_reach=random.choice(["authenticated", "restricted"])
    )
    factories.DocumentFactory(link_reach="public", parent=document)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("reach", ["restricted", "authenticated"])
def test_api_documents_retrieve_anonymous_restricted_or_authenticated(reach):
    """Anonymous users should not be able to retrieve a document that is not public."""
    document = factories.DocumentFactory(link_reach=reach)

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_retrieve_authenticated_unrelated_public_or_authenticated(reach):
    """
    Authenticated users should be able to retrieve a public/authenticated document to
    which they are not related.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": str(document.id),
        "abilities": {
            "accesses_manage": False,
            "accesses_view": False,
            "ai_transform": document.link_role == "editor",
            "ai_translate": document.link_role == "editor",
            "attachment_upload": document.link_role == "editor",
            "children_create": document.link_role == "editor",
            "children_list": True,
            "collaboration_auth": True,
            "destroy": False,
            "favorite": True,
            "invite_owner": False,
            "link_configuration": False,
            "media_auth": True,
            "move": False,
            "partial_update": document.link_role == "editor",
            "retrieve": True,
            "update": document.link_role == "editor",
            "versions_destroy": False,
            "versions_list": False,
            "versions_retrieve": False,
        },
        "content": document.content,
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 1,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "link_reach": reach,
        "link_role": document.link_role,
        "nb_accesses": 0,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_roles": [],
    }
    assert (
        models.LinkTrace.objects.filter(document=document, user=user).exists() is True
    )


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_retrieve_authenticated_public_or_authenticated_parent(reach):
    """
    Authenticated users should be allowed to retrieve a document who has a public or
    authenticated ancestor.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory(link_reach=reach)
    parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
    document = factories.DocumentFactory(link_reach="restricted", parent=parent)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 200
    assert response.json() == {
        "id": str(document.id),
        "abilities": {
            "accesses_manage": False,
            "accesses_view": False,
            "ai_transform": grand_parent.link_role == "editor",
            "ai_translate": grand_parent.link_role == "editor",
            "attachment_upload": grand_parent.link_role == "editor",
            "children_create": grand_parent.link_role == "editor",
            "children_list": True,
            "collaboration_auth": True,
            "destroy": False,
            "favorite": True,
            "invite_owner": False,
            "link_configuration": False,
            "move": False,
            "media_auth": True,
            "partial_update": grand_parent.link_role == "editor",
            "retrieve": True,
            "update": grand_parent.link_role == "editor",
            "versions_destroy": False,
            "versions_list": False,
            "versions_retrieve": False,
        },
        "content": document.content,
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 3,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "link_reach": document.link_reach,
        "link_role": document.link_role,
        "nb_accesses": 0,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_roles": [],
    }


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_retrieve_authenticated_public_or_authenticated_child(reach):
    """
    Authenticated users having access to a document should not gain access to a parent document.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    factories.DocumentFactory(link_reach=reach, parent=document)

    response = client.get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize("reach", ["public", "authenticated"])
def test_api_documents_retrieve_authenticated_trace_twice(reach):
    """
    Accessing a document several times should not raise any error even though the
    trace already exists for this document and user.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach)
    assert (
        models.LinkTrace.objects.filter(document=document, user=user).exists() is False
    )

    client.get(
        f"/api/v1.0/documents/{document.id!s}/",
    )
    assert (
        models.LinkTrace.objects.filter(document=document, user=user).exists() is True
    )

    # A second visit should not raise any error
    response = client.get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 200


def test_api_documents_retrieve_authenticated_unrelated_restricted():
    """
    Authenticated users should not be allowed to retrieve a document that is restricted and
    to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_retrieve_authenticated_related_direct():
    """
    Authenticated users should be allowed to retrieve a document to which they
    are directly related whatever the role.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    access = factories.UserDocumentAccessFactory(document=document, user=user)
    factories.UserDocumentAccessFactory(document=document)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": str(document.id),
        "abilities": document.get_abilities(user),
        "content": document.content,
        "creator": str(document.creator.id),
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "depth": 1,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "link_reach": document.link_reach,
        "link_role": document.link_role,
        "nb_accesses": 2,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_roles": [access.role],
    }


def test_api_documents_retrieve_authenticated_related_parent():
    """
    Authenticated users should be allowed to retrieve a document if they are related
    to one of its ancestors whatever the role.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory(link_reach="restricted")
    parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
    document = factories.DocumentFactory(parent=parent, link_reach="restricted")

    access = factories.UserDocumentAccessFactory(document=grand_parent, user=user)
    factories.UserDocumentAccessFactory(document=grand_parent)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": str(document.id),
        "abilities": {
            "accesses_manage": access.role in ["administrator", "owner"],
            "accesses_view": True,
            "ai_transform": access.role != "reader",
            "ai_translate": access.role != "reader",
            "attachment_upload": access.role != "reader",
            "children_create": access.role != "reader",
            "children_list": True,
            "collaboration_auth": True,
            "destroy": access.role == "owner",
            "favorite": True,
            "invite_owner": access.role == "owner",
            "link_configuration": access.role in ["administrator", "owner"],
            "media_auth": True,
            "move": access.role in ["administrator", "owner"],
            "partial_update": access.role != "reader",
            "retrieve": True,
            "update": access.role != "reader",
            "versions_destroy": access.role in ["administrator", "owner"],
            "versions_list": True,
            "versions_retrieve": True,
        },
        "content": document.content,
        "creator": str(document.creator.id),
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "depth": 3,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "link_reach": "restricted",
        "link_role": document.link_role,
        "nb_accesses": 2,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_roles": [access.role],
    }


def test_api_documents_retrieve_authenticated_related_nb_accesses():
    """Validate computation of number of accesses."""
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory(link_reach="restricted")
    parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
    document = factories.DocumentFactory(parent=parent, link_reach="restricted")

    factories.UserDocumentAccessFactory(document=grand_parent, user=user)
    factories.UserDocumentAccessFactory(document=parent)
    factories.UserDocumentAccessFactory(document=document)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
    )
    assert response.status_code == 200
    assert response.json()["nb_accesses"] == 3

    factories.UserDocumentAccessFactory(document=grand_parent)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
    )
    assert response.status_code == 200
    assert response.json()["nb_accesses"] == 4


def test_api_documents_retrieve_authenticated_related_child():
    """
    Authenticated users should not be allowed to retrieve a document as a result of being
    related to one of its children.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")
    child = factories.DocumentFactory(parent=document)

    factories.UserDocumentAccessFactory(document=child, user=user)
    factories.UserDocumentAccessFactory(document=document)

    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/",
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


def test_api_documents_retrieve_authenticated_related_team_none(mock_user_teams):
    """
    Authenticated users should not be able to retrieve a restricted document related to
    teams in which the user is not.
    """
    mock_user_teams.return_value = []

    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")

    factories.TeamDocumentAccessFactory(
        document=document, team="readers", role="reader"
    )
    factories.TeamDocumentAccessFactory(
        document=document, team="editors", role="editor"
    )
    factories.TeamDocumentAccessFactory(
        document=document, team="administrators", role="administrator"
    )
    factories.TeamDocumentAccessFactory(document=document, team="owners", role="owner")
    factories.TeamDocumentAccessFactory(document=document)
    factories.TeamDocumentAccessFactory()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/")
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@pytest.mark.parametrize(
    "teams,roles",
    [
        [["readers"], ["reader"]],
        [["unknown", "readers"], ["reader"]],
        [["editors"], ["editor"]],
        [["unknown", "editors"], ["editor"]],
    ],
)
def test_api_documents_retrieve_authenticated_related_team_members(
    teams, roles, mock_user_teams
):
    """
    Authenticated users should be allowed to retrieve a document to which they
    are related via a team whatever the role.
    """
    mock_user_teams.return_value = teams

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")

    factories.TeamDocumentAccessFactory(
        document=document, team="readers", role="reader"
    )
    factories.TeamDocumentAccessFactory(
        document=document, team="editors", role="editor"
    )
    factories.TeamDocumentAccessFactory(
        document=document, team="administrators", role="administrator"
    )
    factories.TeamDocumentAccessFactory(document=document, team="owners", role="owner")
    factories.TeamDocumentAccessFactory(document=document)
    factories.TeamDocumentAccessFactory()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/")

    # pylint: disable=R0801
    assert response.status_code == 200
    assert response.json() == {
        "id": str(document.id),
        "abilities": document.get_abilities(user),
        "content": document.content,
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 1,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "link_reach": "restricted",
        "link_role": document.link_role,
        "nb_accesses": 5,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_roles": roles,
    }


@pytest.mark.parametrize(
    "teams,roles",
    [
        [["administrators"], ["administrator"]],
        [["editors", "administrators"], ["administrator", "editor"]],
        [["unknown", "administrators"], ["administrator"]],
    ],
)
def test_api_documents_retrieve_authenticated_related_team_administrators(
    teams, roles, mock_user_teams
):
    """
    Authenticated users should be allowed to retrieve a document to which they
    are related via a team whatever the role.
    """
    mock_user_teams.return_value = teams

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")

    factories.TeamDocumentAccessFactory(
        document=document, team="readers", role="reader"
    )
    factories.TeamDocumentAccessFactory(
        document=document, team="editors", role="editor"
    )
    factories.TeamDocumentAccessFactory(
        document=document, team="administrators", role="administrator"
    )
    factories.TeamDocumentAccessFactory(document=document, team="owners", role="owner")
    factories.TeamDocumentAccessFactory(document=document)
    factories.TeamDocumentAccessFactory()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/")

    # pylint: disable=R0801
    assert response.status_code == 200
    assert response.json() == {
        "id": str(document.id),
        "abilities": document.get_abilities(user),
        "content": document.content,
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 1,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "link_reach": "restricted",
        "link_role": document.link_role,
        "nb_accesses": 5,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_roles": roles,
    }


@pytest.mark.parametrize(
    "teams,roles",
    [
        [["owners"], ["owner"]],
        [["owners", "administrators"], ["owner", "administrator"]],
        [["members", "administrators", "owners"], ["owner", "administrator"]],
        [["unknown", "owners"], ["owner"]],
    ],
)
def test_api_documents_retrieve_authenticated_related_team_owners(
    teams, roles, mock_user_teams
):
    """
    Authenticated users should be allowed to retrieve a restricted document to which
    they are related via a team whatever the role.
    """
    mock_user_teams.return_value = teams

    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach="restricted")

    factories.TeamDocumentAccessFactory(
        document=document, team="readers", role="reader"
    )
    factories.TeamDocumentAccessFactory(
        document=document, team="editors", role="editor"
    )
    factories.TeamDocumentAccessFactory(
        document=document, team="administrators", role="administrator"
    )
    factories.TeamDocumentAccessFactory(document=document, team="owners", role="owner")
    factories.TeamDocumentAccessFactory(document=document)
    factories.TeamDocumentAccessFactory()

    response = client.get(f"/api/v1.0/documents/{document.id!s}/")

    # pylint: disable=R0801
    assert response.status_code == 200
    assert response.json() == {
        "id": str(document.id),
        "abilities": document.get_abilities(user),
        "content": document.content,
        "created_at": document.created_at.isoformat().replace("+00:00", "Z"),
        "creator": str(document.creator.id),
        "depth": 1,
        "excerpt": document.excerpt,
        "is_favorite": False,
        "link_reach": "restricted",
        "link_role": document.link_role,
        "nb_accesses": 5,
        "numchild": 0,
        "path": document.path,
        "title": document.title,
        "updated_at": document.updated_at.isoformat().replace("+00:00", "Z"),
        "user_roles": roles,
    }


def test_api_documents_retrieve_user_roles(django_assert_num_queries):
    """
    Roles should be annotated on querysets taking into account all documents ancestors.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    grand_parent = factories.DocumentFactory(
        users=factories.UserFactory.create_batch(2)
    )
    parent = factories.DocumentFactory(
        parent=grand_parent, users=factories.UserFactory.create_batch(2)
    )
    document = factories.DocumentFactory(
        parent=parent, users=factories.UserFactory.create_batch(2)
    )

    accesses = (
        factories.UserDocumentAccessFactory(document=grand_parent, user=user),
        factories.UserDocumentAccessFactory(document=parent, user=user),
        factories.UserDocumentAccessFactory(document=document, user=user),
    )
    expected_roles = {access.role for access in accesses}

    with django_assert_num_queries(8):
        response = client.get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 200

    user_roles = response.json()["user_roles"]
    assert set(user_roles) == expected_roles


def test_api_documents_retrieve_numqueries_with_link_trace(django_assert_num_queries):
    """If the link traced already exists, the number of queries should be minimal."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[user], link_traces=[user])

    with django_assert_num_queries(2):
        response = client.get(f"/api/v1.0/documents/{document.id!s}/")

    assert response.status_code == 200

    assert response.json()["id"] == str(document.id)
