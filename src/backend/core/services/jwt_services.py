"""JWT services."""

import hashlib
import json
import logging
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

import jwt

logger = logging.getLogger(__name__)

ALGORITHM = "RS256"
CACHE_KEY_PREFIX = "jwt_token"


class JWTError(Exception):
    """Base exception for JWT related errors."""


class ConfigurationError(JWTError):
    """Raised when the JWT service is not properly configured."""


class TokenGenerationError(JWTError):
    """Raised when a token cannot be signed."""


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
        configured lifetime, and take precedence over the caller's claims.
        """
        issued_at = timezone.now()
        payload = {
            **claims,
            "iat": issued_at,
            "exp": issued_at + timedelta(seconds=self.lifetime),
        }

        try:
            return jwt.encode(payload, self.private_key, algorithm=self.algorithm)
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
