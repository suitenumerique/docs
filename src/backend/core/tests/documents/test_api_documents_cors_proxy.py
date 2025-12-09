"""Test on the CORS proxy API for documents."""

import socket
import unittest.mock

import pytest
import responses
from requests.exceptions import RequestException
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
@responses.activate
def test_api_docs_cors_proxy_valid_url(mock_getaddrinfo):
    """Test the CORS proxy API for documents with a valid URL."""
    document = factories.DocumentFactory(link_reach="public")

    # Mock DNS resolution to return a public IP address
    mock_getaddrinfo.return_value = [
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("8.8.8.8", 0))
    ]

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


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
@responses.activate
def test_api_docs_cors_proxy_anonymous_document_not_public(mock_getaddrinfo):
    """Test the CORS proxy API for documents with an anonymous user and a non-public document."""
    document = factories.DocumentFactory(link_reach="authenticated")

    # Mock DNS resolution to return a public IP address
    mock_getaddrinfo.return_value = [
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("8.8.8.8", 0))
    ]

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


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
@responses.activate
def test_api_docs_cors_proxy_authenticated_user_accessing_protected_doc(
    mock_getaddrinfo,
):
    """
    Test the CORS proxy API for documents with an authenticated user accessing a protected
    document.
    """
    document = factories.DocumentFactory(link_reach="authenticated")

    # Mock DNS resolution to return a public IP address
    mock_getaddrinfo.return_value = [
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("8.8.8.8", 0))
    ]

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


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
@responses.activate
def test_api_docs_cors_proxy_authenticated_not_accessing_restricted_doc(
    mock_getaddrinfo,
):
    """
    Test the CORS proxy API for documents with an authenticated user not accessing a restricted
    document.
    """
    document = factories.DocumentFactory(link_reach="restricted")

    # Mock DNS resolution to return a public IP address
    mock_getaddrinfo.return_value = [
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("8.8.8.8", 0))
    ]

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


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
@responses.activate
def test_api_docs_cors_proxy_unsupported_media_type(mock_getaddrinfo):
    """Test the CORS proxy API for documents with an unsupported media type."""
    document = factories.DocumentFactory(link_reach="public")

    # Mock DNS resolution to return a public IP address
    mock_getaddrinfo.return_value = [
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("8.8.8.8", 0))
    ]

    client = APIClient()
    url_to_fetch = "https://external-url.com/assets/index.html"
    responses.get(url_to_fetch, body=b"", status=200, content_type="text/html")
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid URL used."}


@pytest.mark.parametrize(
    "url_to_fetch",
    [
        "ftp://external-url.com/assets/index.html",
        "ftps://external-url.com/assets/index.html",
        "invalid-url.com",
        "ssh://external-url.com/assets/index.html",
    ],
)
def test_api_docs_cors_proxy_invalid_url(url_to_fetch):
    """Test the CORS proxy API for documents with an invalid URL."""
    document = factories.DocumentFactory(link_reach="public")

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json() == ["Enter a valid URL."]


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
@responses.activate
def test_api_docs_cors_proxy_request_failed(mock_getaddrinfo):
    """Test the CORS proxy API for documents with a request failed."""
    document = factories.DocumentFactory(link_reach="public")

    # Mock DNS resolution to return a public IP address
    mock_getaddrinfo.return_value = [
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("8.8.8.8", 0))
    ]

    client = APIClient()
    url_to_fetch = "https://external-url.com/assets/index.html"
    responses.get(url_to_fetch, body=RequestException("Connection refused"))
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "Failed to fetch resource from https://external-url.com/assets/index.html"
    }


@pytest.mark.parametrize(
    "url_to_fetch",
    [
        "http://localhost/image.png",
        "https://localhost/image.png",
        "http://127.0.0.1/image.png",
        "https://127.0.0.1/image.png",
        "http://0.0.0.0/image.png",
        "https://0.0.0.0/image.png",
        "http://[::1]/image.png",
        "https://[::1]/image.png",
        "http://[0:0:0:0:0:0:0:1]/image.png",
        "https://[0:0:0:0:0:0:0:1]/image.png",
    ],
)
def test_api_docs_cors_proxy_blocks_localhost(url_to_fetch):
    """Test that the CORS proxy API blocks localhost variations."""
    document = factories.DocumentFactory(link_reach="public")

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid URL used."


@pytest.mark.parametrize(
    "url_to_fetch",
    [
        "http://10.0.0.1/image.png",
        "https://10.0.0.1/image.png",
        "http://172.16.0.1/image.png",
        "https://172.16.0.1/image.png",
        "http://192.168.1.1/image.png",
        "https://192.168.1.1/image.png",
        "http://10.255.255.255/image.png",
        "https://10.255.255.255/image.png",
        "http://172.31.255.255/image.png",
        "https://172.31.255.255/image.png",
        "http://192.168.255.255/image.png",
        "https://192.168.255.255/image.png",
    ],
)
def test_api_docs_cors_proxy_blocks_private_ips(url_to_fetch):
    """Test that the CORS proxy API blocks private IP addresses."""
    document = factories.DocumentFactory(link_reach="public")

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid URL used."


@pytest.mark.parametrize(
    "url_to_fetch",
    [
        "http://169.254.1.1/image.png",
        "https://169.254.1.1/image.png",
        "http://169.254.255.255/image.png",
        "https://169.254.255.255/image.png",
    ],
)
def test_api_docs_cors_proxy_blocks_link_local(url_to_fetch):
    """Test that the CORS proxy API blocks link-local addresses."""
    document = factories.DocumentFactory(link_reach="public")

    client = APIClient()
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid URL used."


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
@responses.activate
def test_api_docs_cors_proxy_blocks_dns_rebinding_to_private_ip(mock_getaddrinfo):
    """Test that the CORS proxy API blocks DNS rebinding attacks to private IPs."""
    document = factories.DocumentFactory(link_reach="public")

    # Mock DNS resolution to return a private IP address
    mock_getaddrinfo.return_value = [
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("192.168.1.1", 0))
    ]

    client = APIClient()
    url_to_fetch = "https://malicious-domain.com/image.png"
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid URL used."
    mock_getaddrinfo.assert_called_once()


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
@responses.activate
def test_api_docs_cors_proxy_blocks_dns_rebinding_to_localhost(mock_getaddrinfo):
    """Test that the CORS proxy API blocks DNS rebinding attacks to localhost."""
    document = factories.DocumentFactory(link_reach="public")

    # Mock DNS resolution to return localhost
    mock_getaddrinfo.return_value = [
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("127.0.0.1", 0))
    ]

    client = APIClient()
    url_to_fetch = "https://malicious-domain.com/image.png"
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid URL used."
    mock_getaddrinfo.assert_called_once()


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
def test_api_docs_cors_proxy_handles_dns_resolution_failure(mock_getaddrinfo):
    """Test that the CORS proxy API handles DNS resolution failures gracefully."""
    document = factories.DocumentFactory(link_reach="public")

    # Mock DNS resolution to fail
    mock_getaddrinfo.side_effect = socket.gaierror("Name or service not known")

    client = APIClient()
    url_to_fetch = "https://nonexistent-domain-12345.com/image.png"
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid URL used."
    mock_getaddrinfo.assert_called_once()


@unittest.mock.patch("core.api.viewsets.socket.getaddrinfo")
def test_api_docs_cors_proxy_blocks_multiple_resolved_ips_if_any_private(
    mock_getaddrinfo,
):
    """Test that the CORS proxy API blocks if any resolved IP is private."""
    document = factories.DocumentFactory(link_reach="public")

    # Mock DNS resolution to return both public and private IPs
    mock_getaddrinfo.return_value = [
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("8.8.8.8", 0)),
        (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("192.168.1.1", 0)),
    ]

    client = APIClient()
    url_to_fetch = "https://example.com/image.png"
    response = client.get(
        f"/api/v1.0/documents/{document.id!s}/cors-proxy/?url={url_to_fetch}"
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid URL used."
    mock_getaddrinfo.assert_called_once()
