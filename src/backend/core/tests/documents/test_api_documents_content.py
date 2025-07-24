"""
Tests for Documents API endpoint in impress's core app: content
"""

from unittest.mock import patch

import pytest
import requests
from rest_framework import status
from rest_framework.test import APIClient

from core import choices, factories

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "reach, role",
    [
        ("public", "reader"),
        ("public", "editor"),
    ],
)
@patch("core.services.yprovider_services.YProviderAPI.content")
def test_api_documents_content_public(mock_content, reach, role):
    """Anonymous users should be allowed to access content of public documents."""
    document = factories.DocumentFactory(link_reach=reach, link_role=role)
    mock_content.return_value = {"content": {"some": "data"}}

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(document.id)
    assert data["title"] == document.title
    assert data["content"] == {"some": "data"}
    mock_content.assert_called_once_with(document.content, "json")


@pytest.mark.parametrize(
    "reach, doc_role, user_role",
    [
        ("restricted", "reader", "reader"),
        ("restricted", "reader", "editor"),
        ("restricted", "reader", "administrator"),
        ("restricted", "reader", "owner"),
        ("restricted", "editor", "reader"),
        ("restricted", "editor", "editor"),
        ("restricted", "editor", "administrator"),
        ("restricted", "editor", "owner"),
        ("authenticated", "reader", None),
        ("authenticated", "editor", None),
    ],
)
@patch("core.services.yprovider_services.YProviderAPI.content")
def test_api_documents_content_not_public(mock_content, reach, doc_role, user_role):
    """Authenticated users need access to get non-public document content."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach=reach, link_role=doc_role)
    mock_content.return_value = {"content": {"some": "data"}}

    # First anonymous request should fail
    client = APIClient()
    response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    mock_content.assert_not_called()

    # Login and try again
    client.force_login(user)
    response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    # If restricted, we still should not have access
    if user_role is not None:
        assert response.status_code == status.HTTP_403_FORBIDDEN
        mock_content.assert_not_called()

        # Create an access as a reader. This should unlock the access.
        factories.UserDocumentAccessFactory(
            document=document, user=user, role=user_role
        )

        response = client.get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(document.id)
    assert data["title"] == document.title
    assert data["content"] == {"some": "data"}
    mock_content.assert_called_once_with(document.content, "json")


@pytest.mark.parametrize(
    "content_format",
    ["markdown", "html", "json"],
)
@patch("core.services.yprovider_services.YProviderAPI.content")
def test_api_documents_content_format(mock_content, content_format):
    """Test that the content endpoint returns a specific format."""
    document = factories.DocumentFactory(link_reach="public")
    mock_content.return_value = {"content": "whatever"}

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/content/?content_format={content_format}"
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(document.id)
    assert data["title"] == document.title
    assert data["content"] == "whatever"
    mock_content.assert_called_once_with(document.content, content_format)


@patch("core.services.yprovider_services.YProviderAPI._request")
def test_api_documents_content_invalid_format(mock_request):
    """Test that the content endpoint rejects invalid formats."""
    document = factories.DocumentFactory(link_reach="public")

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/content/?content_format=invalid"
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    mock_request.assert_not_called()


@patch("core.services.yprovider_services.YProviderAPI._request")
def test_api_documents_content_yservice_error(mock_request):
    """Test that service errors are handled properly."""
    document = factories.DocumentFactory(link_reach="public")
    mock_request.side_effect = requests.RequestException()

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/content/")
    mock_request.assert_called_once()
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


@patch("core.services.yprovider_services.YProviderAPI._request")
def test_api_documents_content_nonexistent_document(mock_request):
    """Test that accessing a nonexistent document returns 404."""
    client = APIClient()
    response = client.get(
        "/api/v1.0/documents/00000000-0000-0000-0000-000000000000/content/"
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_request.assert_not_called()


@patch("core.services.yprovider_services.YProviderAPI._request")
def test_api_documents_content_empty_document(mock_request):
    """Test that accessing an empty document returns empty content."""
    document = factories.DocumentFactory(link_reach="public", content="")

    response = APIClient().get(f"/api/v1.0/documents/{document.id!s}/content/")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(document.id)
    assert data["title"] == document.title
    assert data["content"] is None
    mock_request.assert_not_called()
