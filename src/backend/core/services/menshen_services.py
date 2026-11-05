"""
Menshen services.

Menshen is the OAuth 2.0 token exchange server of La Suite (RFC 8693): a
service exchanges the access token a user got from the identity provider for a
token targeting another service, Find for instance, with the scopes Menshen's
exchange rules grant. Menshen introspects the user token with the identity
provider, so only a live access token can be exchanged.

This service exchanges and revokes tokens with the client published by
Menshen, `menshen-client`. A client is opened for each call and closed right
after: Docs only calls Menshen at login and logout, and nothing, neither a
connection nor a cookie, is then shared between the calls of different users.
"""

import logging
from dataclasses import dataclass

from django.conf import settings

import httpx2
from menshen_client import (
    Configuration,
    RevocationRequest,
    TokenExchangeClient,
    TokenExchangeRequest,
    TokenType,
)
from menshen_client.exceptions import ResponseParsingError

from core.instrumentation import outgoing_request

logger = logging.getLogger(__name__)


class MenshenError(Exception):
    """Base exception for Menshen related errors."""


class ConfigurationError(MenshenError):
    """Raised when Menshen is not properly configured."""


class APIError(MenshenError):
    """Raised when Menshen cannot be reached or answers with an error."""

    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class ExchangedToken:
    """A token issued by Menshen, valid for `expires_in` seconds."""

    access_token: str
    expires_in: int


def get_configuration():
    """Return the Menshen client configuration from the settings."""
    if not all(
        (
            settings.MENSHEN_URL,
            settings.MENSHEN_CLIENT_ID,
            settings.MENSHEN_CLIENT_SECRET,
        )
    ):
        raise ConfigurationError(
            "MENSHEN_URL, MENSHEN_CLIENT_ID and MENSHEN_CLIENT_SECRET must be set."
        )
    return Configuration(
        client_id=settings.MENSHEN_CLIENT_ID,
        client_secret=settings.MENSHEN_CLIENT_SECRET,
        server_root_url=settings.MENSHEN_URL,
        requests_timeout=settings.MENSHEN_TIMEOUT,
    )


def get_error_message(error):
    """Describe a failed call to Menshen, with the OAuth error it answered."""
    if not isinstance(error, httpx2.HTTPStatusError):
        return str(error) or error.__class__.__name__

    message = f"Menshen answered {error.response.status_code}"
    try:
        body = error.response.json()
    except ValueError:
        return message
    if isinstance(body, dict) and body.get("error"):
        message = f"{message}: {body['error']}"
        if body.get("error_description"):
            message = f"{message} ({body['error_description']})"
    return message


def call(operation, method, request):
    """
    Send `request` to Menshen with `method` of a client opened for this call, and
    report every failure as an `APIError`: Menshen could not be reached, answered
    an error, or answered something the client cannot parse.
    """
    configuration = get_configuration()
    status_error = None
    try:
        with (
            TokenExchangeClient(configuration) as client,
            outgoing_request("menshen", operation) as observed,
        ):
            try:
                response = method(client, request)
            except httpx2.HTTPStatusError as error:
                # Raised once out of the measure, so that its status is counted
                observed.status = error.response.status_code
                status_error = error
            else:
                observed.status = 200
    except (httpx2.HTTPError, ResponseParsingError) as error:
        raise APIError(get_error_message(error)) from error

    if status_error is not None:
        raise APIError(
            get_error_message(status_error),
            status_code=status_error.response.status_code,
        ) from status_error
    return response


def exchange_token(subject_token, audience, scope):
    """
    Exchange the access token of a user for a token targeting `audience`.

    Args:
        subject_token (str): the access token the user got from the identity
            provider.
        audience (str): the audience id of the target service in Menshen.
        scope (str): the scope to request, e.g. an action scope that Menshen
            replaces by the scopes it grants.

    Returns:
        ExchangedToken: the token and its lifetime, set by Menshen's exchange rule.

    Raises:
        ConfigurationError: if Menshen is not configured.
        APIError: if Menshen could not exchange the token.
    """
    request = TokenExchangeRequest(
        subject_token=subject_token,
        subject_token_type=TokenType.ACCESS_TOKEN,
        audience=audience,
        scope=scope,
    )
    response = call("exchange", TokenExchangeClient.exchange, request)
    return ExchangedToken(
        access_token=response.access_token, expires_in=response.expires_in
    )


def revoke_token(token):
    """
    Revoke a token issued by Menshen.

    Raises:
        ConfigurationError: if Menshen is not configured.
        APIError: if Menshen could not revoke the token.
    """
    call("revoke", TokenExchangeClient.revoke, RevocationRequest(token=token))
