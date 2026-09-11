"""JWT services."""

import functools
import hashlib
import json
import logging
from datetime import timedelta
from enum import StrEnum

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

import jwt
import requests
from joserfc.jwk import KeySet, RSAKey

logger = logging.getLogger(__name__)

ALGORITHM = "RS256"
CACHE_KEY_PREFIX = "jwt_token"
JWKS_CACHE_KEY_PREFIX = "jwks"
# How long a fetched JWKS is served from the cache before being fetched again.
JWKS_CACHE_TIMEOUT = 300
# Minimum delay, in seconds, between two fetches of the same JWKS. A token
# names the key that signed it and anybody can name one that does not exist, so
# the refresh a rotation needs is rate limited: an unknown key costs at most one
# fetch per window, not one per request.
JWKS_REFRESH_COOLDOWN = 30
# Timeout, in seconds, of the fetch of a JWKS. Short: it happens while
# authenticating a request.
JWKS_FETCH_TIMEOUT = 10


class Audiences(StrEnum):
    """Enum of the audiences we can use."""

    Y_CONVERTER = "y-converter"
    YHUB = "yhub"


class JWTError(Exception):
    """Base exception for JWT related errors."""


class ConfigurationError(JWTError):
    """Raised when the JWT service is not properly configured."""


class TokenGenerationError(JWTError):
    """Raised when a token cannot be signed."""


class JWKSError(JWTError):
    """Raised when the keys validating the tokens of a service cannot be used."""


@functools.cache
def import_private_key(private_key):
    """
    Import a PEM encoded RSA private key as a JWK.

    The "kid" is the RFC 7638 thumbprint of the key, so it is stable across
    restarts and changes on its own when the key is rotated. It is computed
    from the public components only, which lets a consumer of the JWKS match
    it against the "kid" advertised in the header of our tokens.

    Parsing a RSA key is expensive, hence the cache. It is keyed on the PEM
    itself so that rotating the key in the settings imports the new one.
    """
    try:
        key = RSAKey.import_key(private_key)
        return RSAKey.import_key(
            private_key,
            parameters={
                "alg": ALGORITHM,
                "use": "sig",
                "kid": key.thumbprint(),
            },
        )
    except (TypeError, ValueError) as err:
        raise ConfigurationError("The JWT private key cannot be imported.") from err


@functools.cache
def import_jwks(jwks):
    """
    Import a JSON Web Key Set, as published by the service issuing the tokens.

    Importing keys is expensive, hence the cache. It is keyed on the document
    itself, so a service publishing a new key gets it imported instead of the
    previous set being served forever.
    """
    try:
        return jwt.PyJWKSet.from_json(jwks)
    # a JWKS is fetched from another service: anything malformed in it, from
    # the JSON to the key material, must surface as a JWKS error
    except (jwt.PyJWTError, AttributeError, TypeError, ValueError) as err:
        raise JWKSError("The JWKS cannot be imported.") from err


class JWKSClient:
    """
    Client of the JSON Web Key Set a service publishes to let us verify the
    tokens it signs.

    Fetching and importing the keys on every token would be wasteful, so the
    document is cached — in the Django cache, hence shared by our processes —
    and its import memoized. The service can still roll its key without
    anything changing here: a token signed by a key we do not know refreshes
    the set.
    """

    def __init__(self, url, timeout=JWKS_FETCH_TIMEOUT):
        """Bind the client to the url a service publishes its keys at."""
        self.url = url
        self.timeout = timeout

    @property
    def cache_key(self):
        """Build the cache key holding the document published at our url."""
        digest = hashlib.sha256(self.url.encode("utf-8")).hexdigest()
        return f"{JWKS_CACHE_KEY_PREFIX}:{digest}"

    def fetch(self):
        """Fetch the published document and cache it, as published."""
        try:
            response = requests.get(self.url, timeout=self.timeout)
            response.raise_for_status()
        except requests.RequestException as err:
            logger.exception("Unable to fetch the JWKS at %s", self.url)
            raise JWKSError(f"Unable to fetch the JWKS at {self.url}") from err

        cache.set(self.cache_key, response.text, JWKS_CACHE_TIMEOUT)

        return response.text

    def get_keys(self, refresh=False):
        """Return the published keys, from the cache unless a refresh is asked."""
        jwks = None if refresh else cache.get(self.cache_key)
        if jwks is None:
            jwks = self.fetch()

        return import_jwks(jwks)

    def get_signing_key(self, token):
        """
        Return the key a token was signed with, among the published ones.

        The header of the token names it, which is what makes a rotation
        transparent: a key we do not know yet is looked for again in a freshly
        fetched set. That name is not authenticated though, so the refresh is
        rate limited, and a token naming a key nobody published is refused.
        """
        try:
            kid = jwt.get_unverified_header(token)["kid"]
        except (jwt.PyJWTError, KeyError) as err:
            raise JWKSError("The token does not name the key that signed it.") from err

        try:
            return self.get_keys()[kid]
        except KeyError:
            pass

        # `add` only succeeds for the first caller of the cooldown window,
        # whichever process it runs in
        if not cache.add(f"{self.cache_key}:refresh", True, JWKS_REFRESH_COOLDOWN):
            raise JWKSError(f'The JWKS at {self.url} has no key "{kid}".')

        logger.info('Unknown key "%s", refreshing the JWKS at %s', kid, self.url)
        try:
            return self.get_keys(refresh=True)[kid]
        except KeyError as err:
            raise JWKSError(f'The JWKS at {self.url} has no key "{kid}".') from err


class JWTService:
    """
    Service class issuing RS256 signed JSON Web Tokens.

    The claims are injected by the caller at generation time, the service only
    owns the signature and the token lifetime. Generated tokens are cached for
    their whole lifetime so that repeated calls with the same claims reuse the
    same token instead of signing a new one.
    """

    algorithm = ALGORITHM

    @property
    def private_key(self):
        """Return the RSA private key used to sign the tokens."""
        private_key = settings.JWT_PRIVATE_KEY
        if not private_key:
            raise ConfigurationError(
                "The JWT_PRIVATE_KEY setting is required to sign tokens."
            )
        return private_key

    @property
    def lifetime(self):
        """Return the token lifetime, in seconds."""
        return settings.JWT_TOKEN_LIFETIME

    @property
    def key(self):
        """Return the signing key, as a JWK."""
        return import_private_key(self.private_key)

    @property
    def kid(self):
        """Return the identifier of the signing key, as advertised in the JWKS."""
        return self.key.kid

    def get_jwks(self):
        """
        Return the JSON Web Key Set publishing the public part of our key.

        External services validating our tokens fetch it to get the public key
        matching the "kid" of the token they received. It never exposes the
        private components of the key.
        """
        return KeySet([self.key]).as_dict(private=False)

    def get_cache_key(self, claims):
        """
        Build the cache key identifying a token for the given claims.

        The signing key and the lifetime are part of the fingerprint so that
        rotating the key or changing the lifetime never serves a stale token.
        """
        fingerprint = json.dumps(
            {
                "claims": claims,
                "lifetime": self.lifetime,
                "key": self.private_key,
            },
            sort_keys=True,
            default=str,
        )
        digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()
        return f"{CACHE_KEY_PREFIX}:{digest}"

    def generate_token(self, claims):
        """
        Sign a new token embedding the given claims.

        The "iat" and "exp" claims are always set by the service, from the
        configured lifetime, and take precedence over the caller's claims. The
        header carries the "kid" of the signing key, so that a service
        validating the token can pick the matching key in our JWKS.
        """
        issued_at = timezone.now()
        payload = {
            **claims,
            "iat": issued_at,
            "exp": issued_at + timedelta(seconds=self.lifetime),
        }

        try:
            return jwt.encode(
                payload,
                self.private_key,
                algorithm=self.algorithm,
                headers={"kid": self.kid},
            )
        except (jwt.PyJWTError, TypeError, ValueError) as err:
            logger.exception(
                "Unable to sign a JWT token with algorithm %s", self.algorithm
            )
            raise TokenGenerationError("Unable to sign the JWT token") from err

    def get_token(self, claims):
        """
        Return a token embedding the given claims, generating it if needed.

        The token is cached for its own lifetime, so a cached token can be
        returned close to its expiry. Callers needing a guaranteed remaining
        validity should account for it in the configured lifetime.
        """
        cache_key = self.get_cache_key(claims)

        token = cache.get(cache_key)
        if token is not None:
            return token

        token = self.generate_token(claims)
        cache.set(cache_key, token, self.lifetime)

        return token

    def get_admin_token(self, audience: Audiences, claims=None):
        """
        Return a token with the `admin: true` claim.

        Extra claims can be injected alongside it. They cannot turn the "admin"
        claim off: a token issued by this method always grants admin.
        """
        return self.get_token({**(claims or {}), "admin": True, "aud": audience})
