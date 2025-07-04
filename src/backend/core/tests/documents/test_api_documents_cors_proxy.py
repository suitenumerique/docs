"""Test on the CORS proxy API for documents."""

import pytest
import responses
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


@responses.activate
def test_api_docs_cors_proxy_valid_url():
    """Test the CORS proxy API for documents with a valid URL."""
    document = factories.DocumentFactory(link_reach="public")

    client = APIClient()
    url_to_fetch = "https://external-url.com/assets/logo-gouv.png"
    responses.get(url_to_fetch, body=b"", status=200, content_type="image/png")
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "image/png"
    assert response.headers["Content-Disposition"] == "attachment;"
    policy_list = sorted(response.headers["Content-Security-Policy"].split("; "))
    assert policy_list == [
        "base-uri 'none'",
        "child-src 'none'",
        "connect-src 'none'",
        "default-src 'none'",
        "font-src 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "frame-src 'none'",
        "img-src 'none' data:",
        "manifest-src 'none'",
        "media-src 'none'",
        "object-src 'none'",
        "prefetch-src 'none'",
        "script-src 'none'",
        "style-src 'none'",
        "worker-src 'none'",
    ]
    assert response.streaming_content


def test_api_docs_cors_proxy_without_url_query_string():
    """Test the CORS proxy API for documents without a URL query string."""
    document = factories.DocumentFactory(link_reach="public")

    client = APIClient()
    response = client.get(f"/api/v1.0/documents/{document.id!s}/cors-proxy/")
    assert response.status_code == 400
    assert response.json() == {"detail": "Missing 'url' query parameter"}


@responses.activate
def test_api_docs_cors_proxy_anonymous_document_not_public():
    """Test the CORS proxy API for documents with an anonymous user and a non-public document."""
    document = factories.DocumentFactory(link_reach="authenticated")

    client = APIClient()
    url_to_fetch = "https://external-url.com/assets/logo-gouv.png"
    responses.get(url_to_fetch, body=b"", status=200, content_type="image/png")
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 401
    assert response.json() == {
        "detail": "Authentication credentials were not provided."
    }


@responses.activate
def test_api_docs_cors_proxy_authenticated_user_accessing_protected_doc():
    """
    Test the CORS proxy API for documents with an authenticated user accessing a protected
    document.
    """
    document = factories.DocumentFactory(link_reach="authenticated")

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)
    url_to_fetch = "https://external-url.com/assets/logo-gouv.png"
    responses.get(url_to_fetch, body=b"", status=200, content_type="image/png")
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "image/png"
    assert response.headers["Content-Disposition"] == "attachment;"
    policy_list = sorted(response.headers["Content-Security-Policy"].split("; "))
    assert policy_list == [
        "base-uri 'none'",
        "child-src 'none'",
        "connect-src 'none'",
        "default-src 'none'",
        "font-src 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "frame-src 'none'",
        "img-src 'none' data:",
        "manifest-src 'none'",
        "media-src 'none'",
        "object-src 'none'",
        "prefetch-src 'none'",
        "script-src 'none'",
        "style-src 'none'",
        "worker-src 'none'",
    ]
    assert response.streaming_content


@responses.activate
def test_api_docs_cors_proxy_authenticated_not_accessing_restricted_doc():
    """
    Test the CORS proxy API for documents with an authenticated user not accessing a restricted
    document.
    """
    document = factories.DocumentFactory(link_reach="restricted")

    user = factories.UserFactory()

    client = APIClient()
    client.force_login(user)
    url_to_fetch = "https://external-url.com/assets/logo-gouv.png"
    responses.get(url_to_fetch, body=b"", status=200, content_type="image/png")
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "You do not have permission to perform this action."
    }


@responses.activate
def test_api_docs_cors_proxy_unsupported_media_type():
    """Test the CORS proxy API for documents with an unsupported media type."""
    document = factories.DocumentFactory(link_reach="public")

    client = APIClient()
    url_to_fetch = "https://external-url.com/assets/index.html"
    responses.get(url_to_fetch, body=b"", status=200, content_type="text/html")
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 415
