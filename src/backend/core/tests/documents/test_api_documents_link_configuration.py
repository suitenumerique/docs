"""Tests for link configuration of documents on API endpoint"""

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import serializers
from core.tests.conftest import TEAM, USER, VIA
from core.tests.test_services_collaboration_services import (  # pylint: disable=unused-import
    mock_reset_connections,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_documents_link_configuration_update_anonymous(reach, role):
    """Anonymous users should not be allowed to update a link configuration."""
    document = factories.DocumentFactory(link_reach=reach, link_role=role)
    old_document_values = serializers.LinkDocumentSerializer(instance=document).data

    new_document_values = serializers.LinkDocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = APIClient().put(
        f"/api/v1.0/documents/{document.id!s}/link-configuration/",
        new_document_values,
        format="json",
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }

    document.refresh_from_db()
    document_values = serializers.LinkDocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
@pytest.mark.parametrize("reach", models.LinkReachChoices.values)
def test_api_documents_link_configuration_update_authenticated_unrelated(reach, role):
    """
    Authenticated users should not be allowed to update the link configuration for
    a document to which they are not related.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(link_reach=reach, link_role=role)
    old_document_values = serializers.LinkDocumentSerializer(instance=document).data

    new_document_values = serializers.LinkDocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/link-configuration/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    document_values = serializers.LinkDocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("role", ["editor", "reader"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_link_configuration_update_authenticated_related_forbidden(
    via, role, mock_user_teams
):
    """
    Users who are readers or editors of a document should not be allowed to update
    the link configuration.
    """
    user = factories.UserFactory(with_owned_document=True)

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory()
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    old_document_values = serializers.LinkDocumentSerializer(instance=document).data

    new_document_values = serializers.LinkDocumentSerializer(
        instance=factories.DocumentFactory()
    ).data
    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/link-configuration/",
        new_document_values,
        format="json",
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }

    document.refresh_from_db()
    document_values = serializers.LinkDocumentSerializer(instance=document).data
    assert document_values == old_document_values


@pytest.mark.parametrize("role", ["administrator", "owner"])
@pytest.mark.parametrize("via", VIA)
def test_api_documents_link_configuration_update_authenticated_related_success(
    via,
    role,
    mock_user_teams,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    A user who is administrator or owner of a document should be allowed to update
    the link configuration.
    """
    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.AUTHENTICATED,
        link_role=models.LinkRoleChoices.READER,
    )
    if via == USER:
        factories.UserDocumentAccessFactory(document=document, user=user, role=role)
    elif via == TEAM:
        mock_user_teams.return_value = ["lasuite", "unknown"]
        factories.TeamDocumentAccessFactory(
            document=document, team="lasuite", role=role
        )

    new_document_values = serializers.LinkDocumentSerializer(
        instance=factories.DocumentFactory(
            link_reach=models.LinkReachChoices.PUBLIC,
            link_role=models.LinkRoleChoices.EDITOR,
        )
    ).data

    with mock_reset_connections(document.id):
        response = client.put(
            f"/api/v1.0/documents/{document.id!s}/link-configuration/",
            new_document_values,
            format="json",
        )
        assert response.status_code == 200

        document = models.Document.objects.get(pk=document.pk)
        document_values = serializers.LinkDocumentSerializer(instance=document).data
        for key, value in document_values.items():
            assert value == new_document_values[key]


def test_api_documents_link_configuration_update_role_restricted_forbidden():
    """
    Test that trying to set link_role on a document with restricted link_reach
    returns a validation error.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        link_role=models.LinkRoleChoices.READER,
    )

    factories.UserDocumentAccessFactory(
        document=document, user=user, role=models.RoleChoices.OWNER
    )

    # Try to set a meaningful role on a restricted document
    new_data = {
        "link_reach": models.LinkReachChoices.RESTRICTED,
        "link_role": models.LinkRoleChoices.EDITOR,
    }

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/link-configuration/",
        new_data,
        format="json",
    )

    assert response.status_code == 400
    assert "link_role" in response.json()
    assert (
        "Cannot set link_role when link_reach is 'restricted'"
        in response.json()["link_role"][0]
    )


def test_api_documents_link_configuration_update_link_reach_required():
    """
    Test that link_reach is required when updating link configuration.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.PUBLIC,
        link_role=models.LinkRoleChoices.READER,
    )

    factories.UserDocumentAccessFactory(
        document=document, user=user, role=models.RoleChoices.OWNER
    )

    # Try to update without providing link_reach
    new_data = {"link_role": models.LinkRoleChoices.EDITOR}

    response = client.put(
        f"/api/v1.0/documents/{document.id!s}/link-configuration/",
        new_data,
        format="json",
    )

    assert response.status_code == 400
    assert "link_reach" in response.json()
    assert "This field is required" in response.json()["link_reach"][0]


def test_api_documents_link_configuration_update_restricted_without_role_success(
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    Test that setting link_reach to restricted without specifying link_role succeeds.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.PUBLIC,
        link_role=models.LinkRoleChoices.READER,
    )

    factories.UserDocumentAccessFactory(
        document=document, user=user, role=models.RoleChoices.OWNER
    )

    # Only specify link_reach, not link_role
    new_data = {
        "link_reach": models.LinkReachChoices.RESTRICTED,
    }

    with mock_reset_connections(document.id):
        response = client.put(
            f"/api/v1.0/documents/{document.id!s}/link-configuration/",
            new_data,
            format="json",
        )

        assert response.status_code == 200
        document.refresh_from_db()
        assert document.link_reach == models.LinkReachChoices.RESTRICTED


@pytest.mark.parametrize(
    "reach", [models.LinkReachChoices.PUBLIC, models.LinkReachChoices.AUTHENTICATED]
)
@pytest.mark.parametrize("role", models.LinkRoleChoices.values)
def test_api_documents_link_configuration_update_non_restricted_with_valid_role_success(
    reach,
    role,
    mock_reset_connections,  # pylint: disable=redefined-outer-name
):
    """
    Test that setting non-restricted link_reach with valid link_role succeeds.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        link_role=models.LinkRoleChoices.READER,
    )

    factories.UserDocumentAccessFactory(
        document=document, user=user, role=models.RoleChoices.OWNER
    )

    new_data = {
        "link_reach": reach,
        "link_role": role,
    }

    with mock_reset_connections(document.id):
        response = client.put(
            f"/api/v1.0/documents/{document.id!s}/link-configuration/",
            new_data,
            format="json",
        )

        assert response.status_code == 200
        document.refresh_from_db()
        assert document.link_reach == reach
        assert document.link_role == role


def test_api_documents_link_configuration_update_with_ancestor_constraints():
    """
    Test that link configuration respects ancestor constraints using get_select_options.
    This test may need adjustment based on the actual get_select_options implementation.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent_document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.PUBLIC,
        link_role=models.LinkRoleChoices.READER,
    )

    child_document = factories.DocumentFactory(
        parent=parent_document,
        link_reach=models.LinkReachChoices.PUBLIC,
        link_role=models.LinkRoleChoices.READER,
    )

    factories.UserDocumentAccessFactory(
        document=child_document, user=user, role=models.RoleChoices.OWNER
    )

    # Try to set child to PUBLIC when parent is RESTRICTED
    new_data = {
        "link_reach": models.LinkReachChoices.RESTRICTED,
        "link_role": models.LinkRoleChoices.READER,
    }

    response = client.put(
        f"/api/v1.0/documents/{child_document.id!s}/link-configuration/",
        new_data,
        format="json",
    )

    assert response.status_code == 400
    assert "link_reach" in response.json()
    assert (
        "Link reach 'restricted' is not allowed based on parent"
        in response.json()["link_reach"][0]
    )


def test_api_documents_link_configuration_update_invalid_role_for_reach_validation():
    """
    Test the specific validation logic that checks if link_role is allowed for link_reach.
    This tests the code section that validates allowed_roles from get_select_options.
    """
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    parent_document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.AUTHENTICATED,
        link_role=models.LinkRoleChoices.EDITOR,
    )

    child_document = factories.DocumentFactory(
        parent=parent_document,
        link_reach=models.LinkReachChoices.RESTRICTED,
        link_role=models.LinkRoleChoices.READER,
    )

    factories.UserDocumentAccessFactory(
        document=child_document, user=user, role=models.RoleChoices.OWNER
    )

    new_data = {
        "link_reach": models.LinkReachChoices.AUTHENTICATED,
        "link_role": models.LinkRoleChoices.READER,  # This should be rejected
    }

    response = client.put(
        f"/api/v1.0/documents/{child_document.id!s}/link-configuration/",
        new_data,
        format="json",
    )

    assert response.status_code == 400
    assert "link_role" in response.json()
    error_message = response.json()["link_role"][0]
    assert (
        "Link role 'reader' is not allowed for link reach 'authenticated'"
        in error_message
    )
    assert "Allowed roles: editor" in error_message
