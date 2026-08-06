"""
Tests for Documents API endpoint in impress's core app: convert
"""

import base64
from unittest.mock import patch

import pytest
import requests
from rest_framework import status
from rest_framework.test import APIClient

from core import factories
from core.services.yhub_services import (
    ServiceUnavailableError as YHubServiceUnavailableError,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True, name="mock_yhub")
def mock_yhub_fixture():
    """
    The content of a document is held by the collaboration server.

    It stands for a server holding the very content the factories gave the
    documents, which is what an editor connected to it would have saved.
    """

    def get_ydoc(document):
        return base64.b64decode(document.content) if document.content else None

    with patch("core.api.viewsets.YHubService") as mock_service:
        mock_service.return_value.get_ydoc.side_effect = get_ydoc
        yield mock_service


@pytest.mark.parametrize(
    "reach, role",
    [
        ("public", "reader"),
        ("public", "editor"),
    ],
)
@patch("core.services.converter_services.YdocConverter.convert")
def test_api_documents_formatted_content_public(mock_content, reach, role):
    """Anonymous users should be allowed to access content of public documents."""
    document = factories.DocumentFactory(link_reach=reach, link_role=role)
    mock_content.return_value = {"some": "data"}

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/formatted-content/"
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(document.id)
    assert data["title"] == document.title
    assert data["content"] == {"some": "data"}
    mock_content.assert_called_once_with(
        base64.b64decode(document.content),
        "application/vnd.yjs.doc",
        "application/json",
    )


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
@patch("core.services.converter_services.YdocConverter.convert")
def test_api_documents_formatted_content_not_public(
    mock_content, reach, doc_role, user_role
):
    """Authenticated users need access to get non-public document content."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach=reach, link_role=doc_role)
    mock_content.return_value = {"some": "data"}

    # First anonymous request should fail
    client = APIClient()
    response = client.get(f"/api/v1.0/documents/{document.id!s}/formatted-content/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    mock_content.assert_not_called()

    # Login and try again
    client.force_login(user)
    response = client.get(f"/api/v1.0/documents/{document.id!s}/formatted-content/")

    # If restricted, we still should not have access
    if user_role is not None:
        assert response.status_code == status.HTTP_403_FORBIDDEN
        mock_content.assert_not_called()

        # Create an access as a reader. This should unlock the access.
        factories.UserDocumentAccessFactory(
            document=document, user=user, role=user_role
        )

        response = client.get(f"/api/v1.0/documents/{document.id!s}/formatted-content/")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(document.id)
    assert data["title"] == document.title
    assert data["content"] == {"some": "data"}
    mock_content.assert_called_once_with(
        base64.b64decode(document.content),
        "application/vnd.yjs.doc",
        "application/json",
    )


@pytest.mark.parametrize(
    "content_format, accept",
    [
        ("markdown", "text/markdown"),
        ("html", "text/html"),
        ("json", "application/json"),
    ],
)
@patch("core.services.converter_services.YdocConverter.convert")
def test_api_documents_formatted_content_format(mock_content, content_format, accept):
    """Test that the convert endpoint returns a specific format."""
    document = factories.DocumentFactory(link_reach="public")
    mock_content.return_value = {"some": "data"}

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/formatted-content/?content_format={content_format}"
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(document.id)
    assert data["title"] == document.title
    assert data["content"] == {"some": "data"}
    mock_content.assert_called_once_with(
        base64.b64decode(document.content), "application/vnd.yjs.doc", accept
    )


@patch("core.services.converter_services.YdocConverter._request")
def test_api_documents_formatted_content_invalid_format(mock_request):
    """Test that the convert endpoint rejects invalid formats."""
    document = factories.DocumentFactory(link_reach="public")

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/formatted-content/?content_format=invalid"
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    mock_request.assert_not_called()


@patch("core.services.converter_services.YdocConverter._request")
def test_api_documents_formatted_content_yservice_error(mock_request):
    """Test that service errors are handled properly."""
    document = factories.DocumentFactory(link_reach="public")
    mock_request.side_effect = requests.RequestException()

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/formatted-content/"
    )
    mock_request.assert_called_once()
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


@patch("core.services.converter_services.YdocConverter._request")
def test_api_documents_formatted_content_nonexistent_document(mock_request):
    """Test that accessing a nonexistent document returns 404."""
    client = APIClient()
    response = client.get(
        "/api/v1.0/documents/00000000-0000-0000-0000-000000000000/formatted-content/"
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_request.assert_not_called()


@patch("core.services.converter_services.YdocConverter._request")
def test_api_documents_formatted_content_empty_document(mock_request):
    """Test that accessing an empty document returns empty content."""
    document = factories.DocumentFactory(link_reach="public", content="")

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/formatted-content/"
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(document.id)
    assert data["title"] == document.title
    assert data["content"] is None
    mock_request.assert_not_called()


@patch("core.services.converter_services.YdocConverter.convert")
def test_api_documents_formatted_content_from_collaboration_server(
    mock_content, mock_yhub
):
    """The content converted is the one held by the collaboration server."""
    document = factories.DocumentFactory(link_reach="public")
    mock_content.return_value = {"some": "data"}
    # what the collaboration server holds, edited since Django last saw it
    mock_yhub.return_value.get_ydoc.side_effect = None
    mock_yhub.return_value.get_ydoc.return_value = b"\x01\x02edited update"

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/formatted-content/"
    )

    assert response.status_code == status.HTTP_200_OK
    mock_yhub.return_value.get_ydoc.assert_called_once_with(document)
    mock_content.assert_called_once_with(
        b"\x01\x02edited update",
        "application/vnd.yjs.doc",
        "application/json",
    )


@patch("core.services.converter_services.YdocConverter.convert")
def test_api_documents_formatted_content_collaboration_server_error(
    mock_content, mock_yhub
):
    """A content the collaboration server cannot serve should answer a 500."""
    document = factories.DocumentFactory(link_reach="public")
    mock_yhub.return_value.get_ydoc.side_effect = YHubServiceUnavailableError(
        "Failed to connect to the yhub service"
    )

    response = APIClient().get(
        f"/api/v1.0/documents/{document.id!s}/formatted-content/"
    )

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.json() == {"error": "Failed to get document content"}
    mock_content.assert_not_called()
