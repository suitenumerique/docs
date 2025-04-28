"""
Tests for Documents API endpoint in impress's core app: update
"""

import random

from django.contrib.auth.models import AnonymousUser

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import serializers
from core.tests.conftest import TEAM, USER, VIA

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach, role",
    [
        ("restricted", "reader"),
        ("restricted", "editor"),
        ("authenticated", "reader"),
        ("authenticated", "editor"),
        ("public", "reader"),
    ],
)
def test_api_documents_update_anonymous_forbidden(reach, role, via_parent):
    """
    Anonymous users should not be allowed to update a document when link
    configuration does not allow it.
    """
    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = APIClient().put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }

    document.refresh_from_db()
    document_values = serializers.DocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "reach,role",
    [
        ("public", "reader"),
        ("authenticated", "reader"),
        ("restricted", "reader"),
        ("restricted", "editor"),
    ],
)
def test_api_documents_update_authenticated_unrelated_forbidden(
    reach, role, via_parent
):
    """
    Authenticated users should not be allowed to update a document to which
    they are not related if the link configuration does not allow it.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    document_values = serializers.DocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize(
    "is_authenticated,reach,role",
    [
        (False, "public", "editor"),
        (True, "public", "editor"),
        (True, "authenticated", "editor"),
    ],
)
def test_api_documents_update_anonymous_or_authenticated_unrelated(
    is_authenticated, reach, role, via_parent
):
    """
    Anonymous and authenticated users should be able to update a document to which
    they are not related if the link configuration allows it.
    """
    client = APIClient()

    if is_authenticated:
        user = factories.UserFactory(with_owned_document=True)
        client.force_login(user)
    else:
        user = AnonymousUser()

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach=reach, link_role=role)
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
    else:
        document = factories.DocumentFactory(link_reach=reach, link_role=role)

    old_document_values = serializers.DocumentSerializer(instance=document).data
    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document = models.Document.objects.get(pk=document.pk)
    document_values = serializers.DocumentSerializer(instance=document).data
    for key, value in document_values.items():
        if key in [
            "id",
            "ancestors_link_reach",
            "ancestors_link_role",
            "accesses",
            "created_at",
            "creator",
            "depth",
            "link_reach",
            "link_role",
            "numchild",
            "path",
        ]:
            assert value == old_document_values[key]
        elif key == "updated_at":
            assert value > old_document_values[key]
        else:
            assert value == new_document_values[key]


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_update_authenticated_reader(via, via_parent, mock_user_teams):
    """
    Users who are reader of a document should not be allowed to update it.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role="reader"
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role="reader"
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    document_values = serializers.DocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("via_parent", [True, False])
@pytest.mark.parametrize("role", ["editor", "administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_update_authenticated_editor_administrator_or_owner(
    via, role, via_parent, mock_user_teams
):
    """A user who is editor, administrator or owner of a document should be allowed to update it."""
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    if via_parent:
        grand_parent = factories.DocumentFactory(link_reach="restricted")
        parent = factories.DocumentFactory(parent=grand_parent, link_reach="restricted")
        document = factories.DocumentFactory(parent=parent, link_reach="restricted")
        access_document = grand_parent
    else:
        document = factories.DocumentFactory(link_reach="restricted")
        access_document = document

    if via == USER:
        factories.UserDocumentAccessFactory(
            document=access_document, user=user, role=role
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=access_document, team="lasuite", role=role
        )

    old_document_values = serializers.DocumentSerializer(instance=document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 200

    document = models.Document.objects.get(pk=document.pk)
    document_values = serializers.DocumentSerializer(instance=document).data
    for key, value in document_values.items():
        if key in [
            "id",
            "ancestors_link_reach",
            "ancestors_link_role",
            "created_at",
            "creator",
            "depth",
            "link_reach",
            "link_role",
            "nb_accesses_ancestors",
            "nb_accesses_direct",
            "numchild",
            "path",
        ]:
            assert value == old_document_values[key]
        elif key == "updated_at":
            assert value > old_document_values[key]
        else:
            assert value == new_document_values[key]


@pytest.mark.parametrize("via", VIA)
def test_api_documents_update_administrator_or_owner_of_another(via, mock_user_teams):
    """
    Being administrator or owner of a document should not grant authorization to update
    another document.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(
            document=document, user=user, role=random.choice(["administrator", "owner"])
        )
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document,
            team="lasuite",
            role=random.choice(["administrator", "owner"]),
        )

    other_document = factories.DocumentFactory(title="Old title", link_role="reader")
    old_document_values = serializers.DocumentSerializer(instance=other_document).data

    new_document_values = serializers.DocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{other_document.id!s}/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403

    other_document.refresh_from_db()
    other_document_values = serializers.DocumentSerializer(instance=other_document).data
    assert other_document_values == old_document_values


def test_api_documents_update_invalid_content():
    """
    Updating a document with a non base64 encoded content should raise a validation error.
    """
    user = factories.UserFactory(with_owned_document=True)
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(users=[[user, "owner"]])

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/",
        {"content": "invalid content"},
        format="json",
    )
    assert response.status_code == 400
    assert response.json() == {"content": ["Invalid base64 content."]}
