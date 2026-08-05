"""
yhub API services.

yhub is the collaboration server holding the live Yjs state of the documents
(see `src/yhub-server`). Beside the websocket used by the editors, it exposes a
REST API letting a backend read and act on a document out of band.

Every route is mounted under the `apiPrefix` yhub is configured with, and a
room is addressed as `/{prefix}/{endpoint}/{version}/{org}/{docid}`, where `org`
is the yhub organization Docs runs under and `docid` the document id. The
built-in endpoints are `ydoc` (get the state of a document, patch it with a Yjs
update), `rollback`, `prune`, `changeset` and `activity`, all at `v1`. yhub also
accepts a `branch` query parameter, but our auth plugin only ever grants access
to the `main` branch, so this service never sends it.

This service only owns the transport for now, the endpoints are added as we
need them.
"""

import logging

from django.conf import settings

import requests

from core.services.jwt_services import Audiences, JWTService

logger = logging.getLogger(__name__)


class YHubError(Exception):
    """Base exception for yhub related errors."""


class ConfigurationError(YHubError):
    """Raised when the yhub service is not properly configured."""


class ServiceUnavailableError(YHubError):
    """Raised when the yhub service cannot be reached."""


class APIError(YHubError):
    """Raised when the yhub API answers with an error status."""

    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


class YHubService:
    """
    Client for the REST API of the yhub collaboration server.

    It owns the transport: where yhub lives, how a request is authenticated and
    how a failure is reported. The endpoints themselves are added as we need
    them, on top of `build_url` and `request`.

    A call serving the request of an authenticated user should be made by a
    service built with that user, the token then names them as its subject.
    """

    # Segment every yhub route is mounted under. yhub defaults it to "api", we
    # serve it under "collaboration" and configure its `apiPrefix` to match. It
    # is a single path segment, yhub rejects anything else at startup.
    api_prefix = "collaboration"

    # Version of the endpoints we call, the one all the built-ins are at.
    api_version = "v1"

    def __init__(self, user=None):
        """Bind the service to the user a call is made on behalf of, if any."""
        self.user = user

    @property
    def base_url(self):
        """Return the base url of the yhub API, without its trailing slash."""
        base_url = settings.YHUB_API_BASE_URL
        if not base_url:
            raise ConfigurationError(
                "The YHUB_API_BASE_URL setting is required to reach the yhub API."
            )
        return base_url.rstrip("/")

    @property
    def org(self):
        """Return the yhub organization the documents live in."""
        return settings.YHUB_ORG

    @property
    def timeout(self):
        """Return the timeout of the requests to the yhub API, in seconds."""
        return settings.YHUB_API_TIMEOUT

    @property
    def claims(self):
        """
        Build the claims naming who a request to the yhub API is made for.

        The "sub" claim is only there when the call is made on behalf of an
        authenticated user, so that yhub attributes what it changes to them
        rather than to the backend itself. A call made outside of a request,
        from a Celery task for instance, has no subject to name.
        """
        if self.user is None or not self.user.is_authenticated:
            return {}

        return {"sub": str(self.user.pk)}

    @property
    def auth_header(self):
        """
        Build the authentication header of a request to the yhub API.

        The token always grants admin, a server-to-server call acts on a
        document without going through the abilities of a user. The subject it
        may carry is who the call is for, it never restricts what it can do.
        """
        token = JWTService().get_admin_token(
            audience=Audiences.YHUB, claims=self.claims
        )
        return f"Bearer {token}"

    def build_url(self, endpoint, document_id):
        """Build the url of a document scoped endpoint of the yhub API."""
        return (
            f"{self.base_url}/{self.api_prefix}/{endpoint}/{self.api_version}"
            f"/{self.org}/{document_id}"
        )

    def request(self, method, url, params=None, data=None):
        """
        Send an authenticated request to the yhub API.

        Return the raw response, it is up to the caller to decode its body: the
        endpoints do not all answer with the same payload.
        """
        try:
            response = requests.request(
                method,
                url,
                params=params,
                data=data,
                headers={
                    "Authorization": self.auth_header,
                    "Content-Type": "application/octet-stream",
                },
                timeout=self.timeout,
            )
        except requests.RequestException as err:
            logger.exception("yhub service error: url=%s", url)
            raise ServiceUnavailableError(
                f"Failed to connect to the yhub service at {url}"
            ) from err

        if not response.ok:
            logger.error(
                "yhub API error: url=%s, status=%d, response=%s",
                url,
                response.status_code,
                response.text[:200] if response.text else "empty",
            )
            raise APIError(
                f"The yhub API answered {response.status_code} on {url}",
                status_code=response.status_code,
            )

        return response
