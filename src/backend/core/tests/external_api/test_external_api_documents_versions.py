"""
Tests for the Resource Server API for document versions.

Not testing external API endpoints that are already tested in the /api
because the resource server viewsets inherit from the api viewsets.

"""

import time

from django.test import override_settings

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

# pylint: disable=unused-argument


def test_external_api_documents_versions_list_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to list the versions of a document
    from a resource server by default.
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

    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/versions/")

    assert response.status_code == 403


def test_external_api_documents_versions_detail_not_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD NOT be allowed to retrieve a specific version of a document
    from a resource server by default.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    response = client.get(
        f"/external_api/v1.0/documents/{document.id!s}/versions/1234/"
    )

    assert response.status_code == 403


# Overrides


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": ["list", "retrieve", "children", "versions_list"],
        },
    }
)
def test_external_api_documents_versions_list_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to list version of a document from a resource server
    when the versions action is enabled in EXTERNAL_API settings.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    # Add new versions to the document
    for i in range(3):
        document.content = f"new content {i:d}"
        document.save()

    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/versions/")

    assert response.status_code == 200

    content = response.json()
    assert content["count"] == 2


@override_settings(
    EXTERNAL_API={
        "documents": {
            "enabled": True,
            "actions": [
                "list",
                "retrieve",
                "children",
                "versions_list",
                "versions_detail",
            ],
        },
    }
)
def test_external_api_documents_versions_detail_can_be_allowed(
    user_token, resource_server_backend, user_specific_sub
):
    """
    Connected users SHOULD be allowed to retrieve a specific version of a document
    from a resource server when the versions_detail action is enabled.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token}")

    document = factories.DocumentFactory(link_reach=models.LinkReachChoices.RESTRICTED)
    factories.UserDocumentAccessFactory(
        document=document, user=user_specific_sub, role=models.RoleChoices.OWNER
    )

    # ensure access datetime is earlier than versions (minio precision is one second)
    time.sleep(1)

    # create several versions, spacing them out to get distinct LastModified values
    for i in range(3):
        document.content = f"new content {i:d}"
        document.save()
        time.sleep(1)

    # call the list endpoint and verify basic structure
    response = client.get(f"/external_api/v1.0/documents/{document.id!s}/versions/")
    assert response.status_code == 200

    content = response.json()
    # count should reflect two saved versions beyond the original
    assert content.get("count") == 2

    # pick the first version returned by the list (should be accessible)
    version_id = content.get("versions")[0]["version_id"]

    detailed_response = client.get(
        f"/external_api/v1.0/documents/{document.id!s}/versions/{version_id}/"
    )
    assert detailed_response.status_code == 200
    assert detailed_response.json()["content"] == "new content 1"
