"""
Test how the throttles identify the client of an anonymous request.
"""

from django.test import RequestFactory

import pytest
from rest_framework.test import APIClient

from core import factories
from core.api.throttling import DocumentAccessThrottle, DocumentThrottle
from core.tests.utils.anonymous_id import (
    ANONYMOUS_ID_COOKIE_NAME,
    FORGED_KINDS,
    forge_anonymous_id,
    sign_anonymous_id,
)

THROTTLES = [DocumentThrottle, DocumentAccessThrottle]


def forwarded_request(anonymous_id_cookie=None):
    """
    A request that went through two proxies, the TCP peer being 3.3.3.3,
    carrying the anonymous id cookie if one is given.
    """
    request = RequestFactory().get(
        "/", HTTP_X_FORWARDED_FOR="1.1.1.1, 2.2.2.2", REMOTE_ADDR="3.3.3.3"
    )
    if anonymous_id_cookie is not None:
        request.COOKIES[ANONYMOUS_ID_COOKIE_NAME] = anonymous_id_cookie
    return request


def test_api_throttling_ident_num_proxies_unset_by_default(settings):
    """NUM_PROXIES is unset unless configured, which keeps DRF's behaviour."""
    assert settings.REST_FRAMEWORK["NUM_PROXIES"] is None


@pytest.mark.parametrize("throttle_class", THROTTLES)
def test_api_throttling_ident_num_proxies_unset(throttle_class):
    """Without NUM_PROXIES, the whole X-Forwarded-For header is the identity."""
    assert throttle_class().get_ident(forwarded_request()) == "1.1.1.1,2.2.2.2"


@pytest.mark.parametrize("throttle_class", THROTTLES)
@pytest.mark.parametrize(
    "num_proxies, ident",
    [(0, "3.3.3.3"), (1, "2.2.2.2"), (2, "1.1.1.1")],
)
def test_api_throttling_ident_num_proxies(settings, throttle_class, num_proxies, ident):
    """
    With NUM_PROXIES set, the identity is the address that many positions from
    the right of X-Forwarded-For, or the TCP peer when it is 0.
    """
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": num_proxies}

    assert throttle_class().get_ident(forwarded_request()) == ident


@pytest.mark.parametrize("throttle_class", THROTTLES)
def test_api_throttling_ident_anonymous_id_cookie(throttle_class):
    """A valid anonymous id cookie is the identity, whatever the address."""
    request = forwarded_request(sign_anonymous_id("abc"))

    assert throttle_class().get_ident(request) == "anonymous_abc"


@pytest.mark.parametrize("throttle_class", THROTTLES)
@pytest.mark.parametrize("kind", FORGED_KINDS)
def test_api_throttling_ident_forged_anonymous_id_cookie(throttle_class, kind):
    """A forged anonymous id cookie is ignored: the address is the identity."""
    request = forwarded_request(forge_anonymous_id(kind))

    assert throttle_class().get_ident(request) == "1.1.1.1,2.2.2.2"


@pytest.fixture(name="public_document_url")
def fixture_public_document_url(settings, monkeypatch):
    """The URL of a public document, throttled at 2 requests a minute."""
    monkeypatch.setitem(
        settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], "document", "2/minute"
    )
    document = factories.DocumentFactory(link_reach="public", link_role="reader")
    return f"/api/v1.0/documents/{document.id!s}/"


@pytest.mark.django_db
def test_api_throttling_ident_anonymous_visitors_behind_one_address(
    public_document_url,
):
    """
    Anonymous visitors coming from the same IP address, as behind a NAT, each
    have their own limit once they hold their anonymous id cookie.
    """
    alice, bob = APIClient(), APIClient()
    for client in (alice, bob):
        # The cookie comes with the first response, as when the frontend loads
        client.get("/api/v1.0/config/")
        assert ANONYMOUS_ID_COOKIE_NAME in client.cookies

    assert [alice.get(public_document_url).status_code for _ in range(3)] == [
        200,
        200,
        429,
    ]
    assert bob.get(public_document_url).status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("kind", [None, *FORGED_KINDS])
def test_api_throttling_ident_anonymous_visitors_without_cookie(
    public_document_url, kind
):
    """
    Anonymous visitors without a valid anonymous id cookie fall back to their
    IP address, so behind one address they share their limit.
    """
    statuses = []
    for _ in range(3):
        client = APIClient()
        if kind is not None:
            client.cookies[ANONYMOUS_ID_COOKIE_NAME] = forge_anonymous_id(kind)
        statuses.append(client.get(public_document_url).status_code)

    assert statuses == [200, 200, 429]
