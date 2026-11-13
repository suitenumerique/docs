"""
Test the middleware giving each anonymous visitor a signed id cookie.
"""

import re

import pytest
from rest_framework.test import APIClient

from core import factories
from core.tests.utils.anonymous_id import (
    ANONYMOUS_ID_COOKIE_NAME,
    FORGED_KINDS,
    forge_anonymous_id,
    sign_anonymous_id,
    unsign_anonymous_id,
)

pytestmark = pytest.mark.django_db


def test_middleware_anonymous_id_set_for_an_anonymous_visitor(settings):
    """
    An anonymous visitor without the cookie gets one: signed, holding a random
    id, HttpOnly, Secure, SameSite=Lax and kept for the browser session.
    """
    assert settings.ANONYMOUS_ID_COOKIE_NAME == ANONYMOUS_ID_COOKIE_NAME

    response = APIClient().get("/api/v1.0/config/")

    cookie = response.cookies[ANONYMOUS_ID_COOKIE_NAME]
    anonymous_id = unsign_anonymous_id(cookie.value)
    assert re.fullmatch(r"[0-9a-f]{32}", anonymous_id)
    assert cookie["httponly"] is True
    assert cookie["secure"] is True
    assert cookie["samesite"] == "Lax"
    assert cookie["path"] == "/"
    assert cookie["max-age"] == ""
    assert cookie["expires"] == ""


def test_middleware_anonymous_id_different_for_each_visitor():
    """Two anonymous visitors get different ids."""
    anonymous_ids = {
        unsign_anonymous_id(
            APIClient().get("/api/v1.0/config/").cookies[ANONYMOUS_ID_COOKIE_NAME].value
        )
        for _ in range(2)
    }

    assert len(anonymous_ids) == 2


def test_middleware_anonymous_id_kept_when_valid():
    """A visitor whose cookie is valid keeps it: it is not set again."""
    client = APIClient()
    client.cookies[ANONYMOUS_ID_COOKIE_NAME] = sign_anonymous_id("abc")

    response = client.get("/api/v1.0/config/")

    assert ANONYMOUS_ID_COOKIE_NAME not in response.cookies


@pytest.mark.parametrize("kind", FORGED_KINDS)
def test_middleware_anonymous_id_replaced_when_forged(kind):
    """A cookie without a valid signature is replaced by a new one."""
    client = APIClient()
    client.cookies[ANONYMOUS_ID_COOKIE_NAME] = forge_anonymous_id(kind)

    response = client.get("/api/v1.0/config/")

    cookie = response.cookies[ANONYMOUS_ID_COOKIE_NAME]
    assert unsign_anonymous_id(cookie.value) != "abc"


@pytest.mark.parametrize("path", ["/admin/login/", "/not-an-api-path/"])
def test_middleware_anonymous_id_only_on_api_responses(path):
    """Responses outside the API carry no cookie: only the API is throttled."""
    response = APIClient().get(path)

    assert ANONYMOUS_ID_COOKIE_NAME not in response.cookies


def test_middleware_anonymous_id_not_set_for_an_authenticated_user():
    """An authenticated user is identified by their id: no cookie is set."""
    client = APIClient()
    client.force_login(factories.UserFactory())

    response = client.get("/api/v1.0/config/")

    assert ANONYMOUS_ID_COOKIE_NAME not in response.cookies
