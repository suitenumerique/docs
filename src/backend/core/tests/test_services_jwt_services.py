"""
This module contains tests for the JWTService class in the
core.services.jwt_services module.
"""

from datetime import datetime, timezone
from unittest import mock

from django.core.cache import cache

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from freezegun import freeze_time

from core.services.jwt_services import (
    ConfigurationError,
    JWTService,
    TokenGenerationError,
)


def generate_key_pair():
    """Generate a PEM encoded RSA key pair to sign and verify test tokens."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("utf-8")
    )
    return private_pem, public_pem


# Generating RSA keys is expensive, do it once for the whole module
PRIVATE_KEY, PUBLIC_KEY = generate_key_pair()
OTHER_PRIVATE_KEY, OTHER_PUBLIC_KEY = generate_key_pair()


@pytest.fixture(name="jwt_settings")
def jwt_settings_fixture(settings):
    """Setup valid settings for the JWT service."""
    settings.JWT_PRIVATE_KEY = PRIVATE_KEY
    settings.JWT_TOKEN_LIFETIME = 3600
    return settings


@pytest.mark.usefixtures("jwt_settings")
def test_get_token_signs_the_injected_claims_with_rs256():
    """The generated token is signed with RS256 and carries the given claims."""
    token = JWTService().get_token({"sub": "user-id", "abilities": ["read"]})

    assert jwt.get_unverified_header(token)["alg"] == "RS256"

    payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    assert payload["sub"] == "user-id"
    assert payload["abilities"] == ["read"]


@pytest.mark.usefixtures("jwt_settings")
def test_get_token_cannot_be_verified_with_another_key():
    """The token is signed with the private key defined in the settings."""
    token = JWTService().get_token({"sub": "user-id"})

    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(token, OTHER_PUBLIC_KEY, algorithms=["RS256"])


def test_generate_token_expires_after_the_configured_lifetime(jwt_settings):
    """The "iat" and "exp" claims are computed from the configured lifetime."""
    jwt_settings.JWT_TOKEN_LIFETIME = 300

    now = datetime(2026, 8, 4, 10, 0, 0, tzinfo=timezone.utc)
    with freeze_time(now):
        token = JWTService().generate_token({"sub": "user-id"})
        payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])

    assert payload["iat"] == now.timestamp()
    assert payload["exp"] == now.timestamp() + 300


def test_generate_token_ignores_the_expiry_claims_given_by_the_caller(jwt_settings):
    """The service owns the token lifetime, the caller cannot extend it."""
    jwt_settings.JWT_TOKEN_LIFETIME = 60

    now = datetime(2026, 8, 4, 10, 0, 0, tzinfo=timezone.utc)
    with freeze_time(now):
        token = JWTService().generate_token(
            {"sub": "user-id", "iat": 0, "exp": 99999999999}
        )
        payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])

    assert payload["iat"] == now.timestamp()
    assert payload["exp"] == now.timestamp() + 60


@pytest.mark.usefixtures("jwt_settings")
def test_get_token_reuses_the_cached_token():
    """A token already in cache is returned without signing a new one."""
    service = JWTService()
    claims = {"sub": "user-id"}

    token = service.get_token(claims)
    assert cache.get(service.get_cache_key(claims)) == token

    with mock.patch("core.services.jwt_services.jwt.encode") as mock_encode:
        assert service.get_token(claims) == token

    mock_encode.assert_not_called()


def test_get_token_caches_the_token_for_its_lifetime(jwt_settings):
    """The cache entry expires along with the token it holds."""
    jwt_settings.JWT_TOKEN_LIFETIME = 300

    service = JWTService()
    claims = {"sub": "user-id"}

    with freeze_time("2026-08-04 10:00:00") as frozen_time:
        token = service.get_token(claims)

        frozen_time.move_to("2026-08-04 10:04:59")
        assert cache.get(service.get_cache_key(claims)) == token

        frozen_time.move_to("2026-08-04 10:05:01")
        assert cache.get(service.get_cache_key(claims)) is None


@pytest.mark.usefixtures("jwt_settings")
def test_get_token_caches_each_set_of_claims_separately():
    """Two different sets of claims get two different tokens."""
    service = JWTService()

    first_token = service.get_token({"sub": "user-id"})
    second_token = service.get_token({"sub": "other-user-id"})

    assert first_token != second_token
    assert jwt.decode(first_token, PUBLIC_KEY, algorithms=["RS256"])["sub"] == "user-id"
    assert (
        jwt.decode(second_token, PUBLIC_KEY, algorithms=["RS256"])["sub"]
        == "other-user-id"
    )


@pytest.mark.usefixtures("jwt_settings")
def test_get_token_ignores_the_claims_ordering():
    """Claims given in a different order hit the same cache entry."""
    service = JWTService()

    assert service.get_cache_key({"a": 1, "b": 2}) == service.get_cache_key(
        {"b": 2, "a": 1}
    )


def test_get_token_generates_a_new_token_after_a_key_rotation(jwt_settings):
    """A token signed with a rotated out key is never served from the cache."""
    service = JWTService()
    claims = {"sub": "user-id"}

    service.get_token(claims)

    jwt_settings.JWT_PRIVATE_KEY = OTHER_PRIVATE_KEY
    token = service.get_token(claims)

    assert jwt.decode(token, OTHER_PUBLIC_KEY, algorithms=["RS256"])["sub"] == "user-id"


def test_get_token_generates_a_new_token_when_the_lifetime_changes(jwt_settings):
    """A token cached with the former lifetime is never served."""
    jwt_settings.JWT_TOKEN_LIFETIME = 300

    service = JWTService()
    claims = {"sub": "user-id"}

    with freeze_time("2026-08-04 10:00:00"):
        service.get_token(claims)

        jwt_settings.JWT_TOKEN_LIFETIME = 600
        token = service.get_token(claims)
        payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])

    assert payload["exp"] - payload["iat"] == 600


@pytest.mark.parametrize("private_key", [None, ""])
def test_get_token_without_private_key(jwt_settings, private_key):
    """The service refuses to issue a token when no private key is configured."""
    jwt_settings.JWT_PRIVATE_KEY = private_key

    with pytest.raises(ConfigurationError, match="JWT_PRIVATE_KEY"):
        JWTService().get_token({"sub": "user-id"})


def test_generate_token_with_an_invalid_private_key(jwt_settings):
    """An unusable private key is reported as a token generation error."""
    jwt_settings.JWT_PRIVATE_KEY = "not-a-pem-key"

    with pytest.raises(TokenGenerationError, match="Unable to sign the JWT token"):
        JWTService().generate_token({"sub": "user-id"})
