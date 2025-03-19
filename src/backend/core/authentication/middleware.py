"""
Module to declare a RefreshOIDCAccessToken middleware that extends the
mozilla_django_oidc.middleware.SessionRefresh middleware to refresh the
access token when it expires, based on the OIDC provided refresh token.

This is based on https://github.com/mozilla/mozilla-django-oidc/pull/377
which is still not merged.
"""

import json
import logging
import time
from urllib.parse import quote, urlencode

from django.http import JsonResponse
from django.urls import reverse
from django.utils.crypto import get_random_string

import requests
from mozilla_django_oidc.middleware import SessionRefresh

try:
    from mozilla_django_oidc.middleware import (  # pylint: disable=unused-import
        RefreshOIDCAccessToken as MozillaRefreshOIDCAccessToken,
    )

    # If the import is successful, raise an error to notify the user that the
    # version of mozilla_django_oidc added the expected middleware, and we don't need
    # our implementation anymore.
    # See https://github.com/mozilla/mozilla-django-oidc/pull/377
    raise RuntimeError("This version of mozilla_django_oidc has RefreshOIDCAccessToken")
except ImportError:
    pass

from mozilla_django_oidc.utils import (
    absolutify,
    add_state_and_verifier_and_nonce_to_session,
    import_from_settings,
)

from core.authentication.backends import get_oidc_refresh_token, store_tokens

logger = logging.getLogger(__name__)


class RefreshOIDCAccessToken(SessionRefresh):
    """
    A middleware that will refresh the access token following proper OIDC protocol:
    https://auth0.com/docs/tokens/refresh-token/current

    This is based on https://github.com/mozilla/mozilla-django-oidc/pull/377
    but limited to our needs (YAGNI/KISS).
    """

    def _prepare_reauthorization(self, request):
        """
        Constructs a new authorization grant request to refresh the session.
        Besides constructing the request, the state and nonce included in the
        request are registered in the current session in preparation for the
        client following through with the authorization flow.
        """
        auth_url = self.OIDC_OP_AUTHORIZATION_ENDPOINT
        client_id = self.OIDC_RP_CLIENT_ID
        state = get_random_string(self.OIDC_STATE_SIZE)

        # Build the parameters as if we were doing a real auth handoff, except
        # we also include prompt=none.
        auth_params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": absolutify(
                request, reverse(self.OIDC_AUTHENTICATION_CALLBACK_URL)
            ),
            "state": state,
            "scope": self.OIDC_RP_SCOPES,
            "prompt": "none",
        }

        if self.OIDC_USE_NONCE:
            nonce = get_random_string(self.OIDC_NONCE_SIZE)
            auth_params.update({"nonce": nonce})

        # Register the one-time parameters in the session
        add_state_and_verifier_and_nonce_to_session(request, state, auth_params)
        request.session["oidc_login_next"] = request.get_full_path()

        query = urlencode(auth_params, quote_via=quote)
        return f"{auth_url}?{query}"

    def is_expired(self, request):
        """Check whether the access token is expired and needs to be refreshed."""
        if not self.is_refreshable_url(request):
            logger.debug("request is not refreshable")
            return False

        expiration = request.session.get("oidc_token_expiration", 0)
        now = time.time()
        if expiration > now:
            # The id_token is still valid, so we don't have to do anything.
            logger.debug("id token is still valid (%s > %s)", expiration, now)
            return False

        return True

    def finish(self, request, prompt_reauth=True):
        """Finish request handling and handle sending downstream responses for XHR.
        This function should only be run if the session is determind to
        be expired.
        Almost all XHR request handling in client-side code struggles
        with redirects since redirecting to a page where the user
        is supposed to do something is extremely unlikely to work
        in an XHR request. Make a special response for these kinds
        of requests.
        The use of 403 Forbidden is to match the fact that this
        middleware doesn't really want the user in if they don't
        refresh their session.

        WARNING: this varies from the original implementation:
         - to return a 401 status code
         - to consider all requests as XHR requests
        """
        xhr_response_json = {"error": "the authentication session has expired"}
        if prompt_reauth:
            # The id_token has expired, so we have to re-authenticate silently.
            refresh_url = self._prepare_reauthorization(request)
            xhr_response_json["refresh_url"] = refresh_url

        xhr_response = JsonResponse(xhr_response_json, status=401)
        if "refresh_url" in xhr_response_json:
            xhr_response["refresh_url"] = xhr_response_json["refresh_url"]
        return xhr_response

    def process_request(self, request):  # noqa: PLR0911 # pylint: disable=too-many-return-statements
        """Process the request and refresh the access token if necessary."""
        if not self.is_expired(request):
            return None

        token_url = self.get_settings("OIDC_OP_TOKEN_ENDPOINT")
        client_id = self.get_settings("OIDC_RP_CLIENT_ID")
        client_secret = self.get_settings("OIDC_RP_CLIENT_SECRET")
        refresh_token = get_oidc_refresh_token(request.session)

        if not refresh_token:
            logger.debug("no refresh token stored")
            return self.finish(request, prompt_reauth=True)

        token_payload = {
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
        }

        req_auth = None
        if self.get_settings("OIDC_TOKEN_USE_BASIC_AUTH", False):
            # supported in https://github.com/mozilla/mozilla-django-oidc/pull/377
            # but we don't need it, so enforce error here.
            raise RuntimeError("OIDC_TOKEN_USE_BASIC_AUTH is not supported")

        try:
            response = requests.post(
                token_url,
                auth=req_auth,
                data=token_payload,
                verify=import_from_settings("OIDC_VERIFY_SSL", True),
                timeout=import_from_settings("OIDC_TIMEOUT", 3),
            )
            response.raise_for_status()
            token_info = response.json()
        except requests.exceptions.Timeout:
            logger.debug("timed out refreshing access token")
            # Don't prompt for reauth as this could be a temporary problem
            return self.finish(request, prompt_reauth=False)
        except requests.exceptions.HTTPError as exc:
            status_code = exc.response.status_code
            logger.debug("http error %s when refreshing access token", status_code)
            # OAuth error response will be a 400 for various situations, including
            # an expired token. https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
            return self.finish(request, prompt_reauth=status_code == 400)
        except json.JSONDecodeError:
            logger.debug("malformed response when refreshing access token")
            # Don't prompt for reauth as this could be a temporary problem
            return self.finish(request, prompt_reauth=False)
        except Exception as exc:  # pylint: disable=broad-except
            logger.exception(
                "unknown error occurred when refreshing access token: %s", exc
            )
            # Don't prompt for reauth as this could be a temporary problem
            return self.finish(request, prompt_reauth=False)

        # Until we can properly validate an ID token on the refresh response
        # per the spec[1], we intentionally drop the id_token.
        # [1]: https://openid.net/specs/openid-connect-core-1_0.html#RefreshTokenResponse
        id_token = None
        access_token = token_info.get("access_token")
        refresh_token = token_info.get("refresh_token")
        store_tokens(request.session, access_token, id_token, refresh_token)

        return None
