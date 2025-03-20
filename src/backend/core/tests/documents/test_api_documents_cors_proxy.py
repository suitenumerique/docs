"""Test on the CORS proxy API for documents."""

import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


def test_api_docs_cors_proxy_valid_url():
    """Test the CORS proxy API for documents with a valid URL."""
    document = factories.DocumentFactory(link_reach="public")

    client = APIClient()
    url_to_fetch = "https://docs.numerique.gouv.fr/assets/logo-gouv.png"
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "image/png"
    assert response.streaming_content


def test_api_docs_cors_proxy_without_url_query_string():
    """Test the CORS proxy API for documents without a URL query string."""
    document = factories.DocumentFactory(link_reach="public")

    client = APIClient()
    response = client.get(f"/api/v1.0/documents/{document.id!s}/cors-proxy/")
    assert response.status_code == 400
    assert response.json() == {"detail": "Missing 'url' query parameter"}


def test_api_docs_cors_proxy_anonymous_document_not_public():
    """Test the CORS proxy API for documents with an anonymous user and a non-public document."""
    document = factories.DocumentFactory(link_reach="authenticated")

    client = APIClient()
    url_to_fetch = "https://docs.numerique.gouv.fr/assets/logo-gouv.png"
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


def test_api_docs_cors_proxy_authenticated_user_accessing_protected_doc():
    """
    Test the CORS proxy API for documents with an authenticated user accessing a protected
    document.
    """
    document = factories.DocumentFactory(link_reach="authenticated")

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)
    url_to_fetch = "https://docs.numerique.gouv.fr/assets/logo-gouv.png"
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "image/png"
    assert response.streaming_content


def test_api_docs_cors_proxy_authenticated_not_accessing_restricted_doc():
    """
    Test the CORS proxy API for documents with an authenticated user not accessing a restricted
    document.
    """
    document = factories.DocumentFactory(link_reach="restricted")

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)
    url_to_fetch = "https://docs.numerique.gouv.fr/assets/logo-gouv.png"
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }
