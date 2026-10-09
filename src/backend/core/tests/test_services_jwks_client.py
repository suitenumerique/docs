"""
This module contains tests for the JWKSClient class in the
core.services.jwt_services module.
"""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
import responses

from core.services.jwt_services import JWKSClient, JWKSError
from core.tests.utils.jwt_helper import build_jwks, generate_key_pair, key_id

# Generating RSA keys is expensive, do it once for the whole module
PRIVATE_KEY, PUBLIC_KEY = generate_key_pair()
OTHER_PRIVATE_KEY, OTHER_PUBLIC_KEY = generate_key_pair()

JWKS_URL = "http://service.example.com/jwks"


def signed_token(private_key=PRIVATE_KEY, public_key=PUBLIC_KEY, headers=None):
    """
    Sign a token the way a service publishing a JWKS does.

    Unless the caller wants something else in there, the header names the key
    the token can be validated with.
    """
    return jwt.encode(
        {"exp": datetime.now(tz=timezone.utc) + timedelta(seconds=60)},
        private_key,
        algorithm="RS256",
        headers={"kid": key_id(public_key)} if headers is None else headers,
    )


@pytest.fixture(name="jwks")
def jwks_fixture():
    """Serve the JWKS of the key this module signs its tokens with."""
    with responses.RequestsMock(assert_all_requests_are_fired=False) as mock:
        mock.get(JWKS_URL, json=build_jwks(PUBLIC_KEY))
        yield mock


@pytest.mark.usefixtures("jwks")
def test_get_signing_key_returns_the_published_key():
    """The key a token names should validate its signature."""
    token = signed_token()

    key = JWKSClient(JWKS_URL).get_signing_key(token)

    assert jwt.decode(token, key.key, algorithms=["RS256"])


def test_the_document_is_fetched_once(jwks):
    """Validating tokens should not call the publisher every time."""
    client = JWKSClient(JWKS_URL)

    client.get_signing_key(signed_token())
    client.get_signing_key(signed_token())
    # the document is cached for the url, not for the client instance
    JWKSClient(JWKS_URL).get_signing_key(signed_token())

    assert len(jwks.calls) == 1


def test_an_unknown_key_is_looked_for_in_a_fresh_document(jwks):
    """A key published after the document was cached should still be found."""
    client = JWKSClient(JWKS_URL)
    client.get_signing_key(signed_token())

    # the service rolls its key and publishes the new one
    jwks.reset()
    jwks.get(JWKS_URL, json=build_jwks(OTHER_PUBLIC_KEY))
    token = signed_token(OTHER_PRIVATE_KEY, OTHER_PUBLIC_KEY)

    key = client.get_signing_key(token)

    assert jwt.decode(token, key.key, algorithms=["RS256"])
    assert len(jwks.calls) == 1  # the fetch of the refreshed document


@pytest.mark.usefixtures("jwks")
def test_a_key_nobody_published_is_refused():
    """A token can name any key, only a published one validates it."""
    with pytest.raises(JWKSError, match="has no key"):
        JWKSClient(JWKS_URL).get_signing_key(
            signed_token(headers={"kid": "a-key-nobody-published"})
        )


def test_an_unknown_key_only_refreshes_once_per_cooldown(jwks):
    """
    🔒 A forged "kid" must not turn every request into a call to the publisher.

    Nothing authenticates the key a token names, so without a cooldown an
    unauthenticated caller would have us fetch the document as often as it asks.
    """
    client = JWKSClient(JWKS_URL)

    for _ in range(5):
        with pytest.raises(JWKSError):
            client.get_signing_key(
                signed_token(headers={"kid": "a-key-nobody-published"})
            )

    # the first call fills the cache, the second is the refresh of the window
    assert len(jwks.calls) == 2


@pytest.mark.usefixtures("jwks")
def test_a_token_naming_no_key_is_refused():
    """A token that does not name its key cannot be matched to one."""
    with pytest.raises(JWKSError, match="does not name"):
        JWKSClient(JWKS_URL).get_signing_key(signed_token(headers={}))


@pytest.mark.usefixtures("jwks")
def test_a_token_that_is_not_a_token_is_refused():
    """A header we cannot even read is reported like any unusable token."""
    with pytest.raises(JWKSError, match="does not name"):
        JWKSClient(JWKS_URL).get_signing_key("not-a-token")


@responses.activate
def test_an_unreachable_publisher_is_reported():
    """A service we cannot fetch the keys from validates no token."""
    responses.get(JWKS_URL, status=500)

    with pytest.raises(JWKSError, match="Unable to fetch"):
        JWKSClient(JWKS_URL).get_signing_key(signed_token())


@responses.activate
def test_a_malformed_document_is_reported():
    """A published document we cannot import validates no token either."""
    responses.get(JWKS_URL, body="<html>not a jwks</html>")

    with pytest.raises(JWKSError, match="cannot be imported"):
        JWKSClient(JWKS_URL).get_signing_key(signed_token())


@responses.activate
def test_a_document_without_any_usable_key_is_reported():
    """A publisher answering an empty set is not a publisher we can use."""
    responses.get(JWKS_URL, json={"keys": []})

    with pytest.raises(JWKSError, match="cannot be imported"):
        JWKSClient(JWKS_URL).get_signing_key(signed_token())


@responses.activate
def test_the_documents_of_two_services_do_not_share_a_cache_entry():
    """Two publishers are two documents, whatever each of them holds."""
    other_url = "http://other-service.example.com/jwks"
    responses.get(JWKS_URL, json=build_jwks(PUBLIC_KEY))
    responses.get(other_url, json=build_jwks(OTHER_PUBLIC_KEY))

    JWKSClient(JWKS_URL).get_signing_key(signed_token())
    key = JWKSClient(other_url).get_signing_key(
        signed_token(OTHER_PRIVATE_KEY, OTHER_PUBLIC_KEY)
    )

    assert key.key_id == key_id(OTHER_PUBLIC_KEY)
    assert len(responses.calls) == 2
