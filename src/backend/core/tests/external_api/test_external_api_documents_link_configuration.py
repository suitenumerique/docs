"""
Tests for the Resource Server API for document link configurations.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

from unittest.mock import patch

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_external_api_documents_link_configuration_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to update the link configuration of a document
    from a resource server.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    response = client.put(
        f"/external_api/v1.0/documents/{document.id!s}/link-configuration/"
    )

    assert response.status_code == 403


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
                "link_configuration",
            ],
        },
    },
    COLLABORATION_API_URL="http://example.com/",
    COLLABORATION_SERVER_SECRET="secret-token",
)
@patch("core.services.collaboration_services.CollaborationService.reset_connections")
def test_external_api_documents_link_configuration_can_be_allowed(
    mock_reset, user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to update the link configuration of a document
    from a resource server when the corresponding action is enabled in EXTERNAL_API settings.
    """

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(
        link_reach=models.LinkReachChoices.RESTRICTED,
        creator=user_specific_sub,
    )
    factories.UserDocumentAccessFactory(
        document=document,
        user=user_specific_sub,
        role=models.RoleChoices.OWNER,
    )

    # attempt to change reach/role to a valid combination
    new_data = {
        "link_reach": models.LinkReachChoices.PUBLIC,
        "link_role": models.LinkRoleChoices.EDITOR,
    }

    response = client.put(
        f"/external_api/v1.0/documents/{document.id!s}/link-configuration/",
        new_data,
        format="json",
    )

    assert response.status_code == 200

    # verify the document was updated in the database
    document.refresh_from_db()
    assert document.link_reach == models.LinkReachChoices.PUBLIC
    assert document.link_role == models.LinkRoleChoices.EDITOR
