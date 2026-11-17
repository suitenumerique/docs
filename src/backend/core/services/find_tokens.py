"""
Find tokens of the users, exchanged with Menshen at login.

Find only accepts user tokens exchanged with Menshen. Menshen can only exchange
a live access token of the identity provider, and the refresh token of the
identity provider lives much shorter than a session. So the access token is
exchanged once, right after the OIDC login, while it is fresh, and the token
Menshen issues is kept in the session for the rest of it: Menshen's exchange
rule gives it the lifetime of the session. The search never uses the tokens
of the identity provider.

The token is a bearer living as long as the session: it is kept encrypted, with
its own key, and revoked at logout. A session without a usable token searches
the database instead of Find.
"""

import logging
import time

from django.conf import settings

from cryptography.fernet import Fernet, InvalidToken

from core.services import menshen_services

logger = logging.getLogger(__name__)

# Names of session keys, not secrets
TOKEN_SESSION_KEY = "find_access_token"  # noqa: S105
EXPIRATION_SESSION_KEY = "find_access_token_expiration"
OIDC_ACCESS_TOKEN_SESSION_KEY = "oidc_access_token"  # noqa: S105


class FindTokenConfigurationError(Exception):
    """Raised when the settings needed to get a Find token are missing."""


def get_cipher():
    """Return the cipher of the Find tokens kept in the sessions."""
    key = settings.FIND_TOKEN_ENCRYPTION_KEY
    if not key:
        raise FindTokenConfigurationError("FIND_TOKEN_ENCRYPTION_KEY must be set.")
    try:
        return Fernet(key)
    except ValueError as error:
        raise FindTokenConfigurationError(
            "FIND_TOKEN_ENCRYPTION_KEY must be a Fernet key."
        ) from error


def exchange_find_token(request):
    """
    Exchange the access token of the user, just logged in, for a Find token kept
    in their session. It replaces the Find token the session may already hold,
    which is revoked.

    Called at login for the users who search with Find (see core.signals). It
    never fails: a login must not depend on Menshen. Without a Find token, the
    user searches the database until their next login.
    """
    access_token = request.session.get(OIDC_ACCESS_TOKEN_SESSION_KEY)
    if not access_token:
        logger.warning(
            "No access token in the session to exchange for a Find token, "
            "is OIDC_STORE_ACCESS_TOKEN enabled?"
        )
        return

    try:
        if not (settings.FIND_AUDIENCE and settings.FIND_SEARCH_ACTION_SCOPE):
            raise FindTokenConfigurationError(
                "FIND_AUDIENCE and FIND_SEARCH_ACTION_SCOPE must be set."
            )
        cipher = get_cipher()
        token = menshen_services.exchange_token(
            access_token, settings.FIND_AUDIENCE, settings.FIND_SEARCH_ACTION_SCOPE
        )
    except (FindTokenConfigurationError, menshen_services.MenshenError) as error:
        logger.error("Could not get a Find token at login: %s", error)
        return

    if token.expires_in < settings.SESSION_COOKIE_AGE:
        logger.warning(
            "Menshen granted a Find token for %d seconds, shorter than the "
            "session (SESSION_COOKIE_AGE=%d): the user will search the database "
            "once it has expired",
            token.expires_in,
            settings.SESSION_COOKIE_AGE,
        )

    previous_token = get_find_token(request.session)
    request.session[TOKEN_SESSION_KEY] = cipher.encrypt(
        token.access_token.encode()
    ).decode()
    request.session[EXPIRATION_SESSION_KEY] = time.time() + token.expires_in
    if previous_token:
        revoke(previous_token)


def get_find_token(session):
    """
    Return the Find token of a session, or None if it has none, if it has
    expired, or if it cannot be decrypted (e.g. the key has changed).
    """
    encrypted_token = session.get(TOKEN_SESSION_KEY)
    if not encrypted_token:
        return None

    if session.get(EXPIRATION_SESSION_KEY, 0) <= time.time():
        return None

    try:
        return get_cipher().decrypt(encrypted_token.encode()).decode()
    except (FindTokenConfigurationError, InvalidToken) as error:
        logger.warning("The Find token of a session cannot be decrypted: %s", error)
        return None


def forget_find_token(session):
    """Drop the Find token of a session, e.g. once Find has rejected it."""
    session.pop(TOKEN_SESSION_KEY, None)
    session.pop(EXPIRATION_SESSION_KEY, None)


def revoke(token):
    """Revoke a Find token at Menshen, logging a failure rather than raising it."""
    try:
        menshen_services.revoke_token(token)
    except menshen_services.MenshenError as error:
        logger.error("Could not revoke a Find token: %s", error)


def revoke_find_token(request):
    """
    Revoke the Find token of the session of a user logging out. A token that has
    expired or cannot be decrypted is not revoked: it is no longer usable.
    """
    token = get_find_token(request.session)
    if token:
        revoke(token)
