"""Utils for testing the anonymous id cookie."""

from django.http import HttpResponse
from django.test import RequestFactory

from core.middleware import ANONYMOUS_ID_COOKIE_SALT

ANONYMOUS_ID_COOKIE_NAME = "docs_anonymous_id"

FORGED_KINDS = ["unsigned", "tampered", "other_salt"]


def sign_anonymous_id(value, salt=ANONYMOUS_ID_COOKIE_SALT):
    """The anonymous id cookie holding this value, signed as Django does."""
    response = HttpResponse()
    response.set_signed_cookie(ANONYMOUS_ID_COOKIE_NAME, value, salt=salt)
    return response.cookies[ANONYMOUS_ID_COOKIE_NAME].value


def unsign_anonymous_id(cookie_value):
    """The value of an anonymous id cookie, raising BadSignature if forged."""
    request = RequestFactory().get("/")
    request.COOKIES[ANONYMOUS_ID_COOKIE_NAME] = cookie_value
    return request.get_signed_cookie(
        ANONYMOUS_ID_COOKIE_NAME, salt=ANONYMOUS_ID_COOKIE_SALT
    )


def forge_anonymous_id(kind):
    """
    An anonymous id cookie holding "abc" that must be refused: not signed,
    signed but altered, or signed for another purpose.
    """
    return {
        "unsigned": "abc",
        "tampered": sign_anonymous_id("abc").replace("abc", "abd", 1),
        "other_salt": sign_anonymous_id("abc", salt="another-purpose"),
    }[kind]
