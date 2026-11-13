"""
Test how the throttles identify the client of an anonymous request.
"""

from django.test import RequestFactory

import pytest

from core.api.throttling import DocumentAccessThrottle, DocumentThrottle

THROTTLES = [DocumentThrottle, DocumentAccessThrottle]


def forwarded_request():
    """A request that went through two proxies, the TCP peer being 3.3.3.3."""
    return RequestFactory().get(
        "/", HTTP_X_FORWARDED_FOR="1.1.1.1, 2.2.2.2", REMOTE_ADDR="3.3.3.3"
    )


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
