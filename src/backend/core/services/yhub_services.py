"""
yhub API services.

yhub is the collaboration server holding the live Yjs state of the documents
(see `src/yhub-server`). Beside the websocket used by the editors, it exposes a
REST API letting a backend read and act on a document out of band.

Every route is mounted under the `apiPrefix` yhub is configured with, and a
room is addressed as `/{prefix}/{endpoint}/{version}/{org}/{docid}`, where `org`
is the yhub organization Docs runs under and `docid` the document id. The
built-in endpoints are `ydoc` (get the state of a document, patch it with a Yjs
update, delete it), `rollback`, `prune`, `changeset` and `activity`, all at
`v1`. yhub also
accepts a `branch` query parameter, but our auth plugin only ever grants access
to the `main` branch, so this service never sends it.

Since yhub 0.5.0 those endpoints answer JSON to a request asking for it, with
the binary fields base64 encoded, so this service sends `Accept:
application/json` and reads them without a lib0 decoder. Their errors come back
the same way, as a JSON `{"error": ...}` this service reports along with the
status.

A few routes are about the server itself rather than about a document, and
carry no room: `/{prefix}/jwks/{version}` publishes the public keys validating
the tokens yhub signs to call us back.

This service only owns the transport for now, the endpoints are added as we
need them.
"""

import base64
import logging

from django.conf import settings

import requests

from core.services.jwt_services import Audiences, JWKSClient, JWTService

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

    # A Yjs update carrying no content encodes to 2 bytes, and yhub reads
    # anything up to 3 as an empty document. `ydoc` answers the encoding of an
    # empty document for a room it holds nothing for, never an empty body.
    empty_update_max_bytes = 3

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
    def user_id(self):
        """
        Return the id of the user a call is made on behalf of, if any.

        It is the very id yhub knows a user by: the auth plugin resolves the
        cookies of a websocket client to the same one.
        """
        if self.user is None or not self.user.is_authenticated:
            return None

        return str(self.user.pk)

    @property
    def claims(self):
        """
        Build the claims naming who a request to the yhub API is made for.

        The "sub" claim is only there when the call is made on behalf of an
        authenticated user, so that yhub attributes what it changes to them
        rather than to the backend itself. A call made outside of a request,
        from a Celery task for instance, has no subject to name.
        """
        if self.user_id is None:
            return {}

        return {"sub": self.user_id}

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

    @property
    def jwks_url(self):
        """Return the url yhub publishes its public keys at."""
        return f"{self.base_url}/{self.api_prefix}/jwks/{self.api_version}"

    @property
    def jwks(self):
        """
        Return the client of the keys validating the tokens yhub signs.

        The mirror of the JWKS we publish for the tokens we sign to call it:
        neither side holds a copy of the key of the other, so either can roll
        its own without the other being reconfigured.
        """
        return JWKSClient(self.jwks_url)

    def build_url(self, endpoint, document):
        """Build the url of a document scoped endpoint of the yhub API."""
        return (
            f"{self.base_url}/{self.api_prefix}/{endpoint}/{self.api_version}"
            f"/{self.org}/{document.id}"
        )

    @staticmethod
    def build_user_header(user_id):
        """
        Name a user to yhub, or nobody when there is no user to name.

        yhub only reads this header from a call authenticated as admin, and
        what it does with it depends on the endpoint it is sent to.
        """
        return {"X-User-Id": str(user_id)} if user_id else {}

    # pylint: disable-next=too-many-arguments
    def request(self, method, url, *, data=None, headers=None, timeout=None):
        """
        Send an authenticated request to the yhub API, asking it for JSON.

        Return the raw response, it is up to the caller to decode its body: the
        endpoints do not all answer with the same payload. An endpoint doing
        more than answering a document passes its own timeout.
        """
        try:
            response = requests.request(
                method,
                url,
                data=data,
                headers={
                    "Authorization": self.auth_header,
                    # what makes yhub answer JSON rather than its lib0 encoding
                    "Accept": "application/json",
                    **(headers or {}),
                },
                timeout=timeout or self.timeout,
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
            detail = self.json_body(response).get("error")
            raise APIError(
                f"The yhub API answered {response.status_code} on {url}"
                + (f": {detail}" if detail else ""),
                status_code=response.status_code,
            )

        return response

    @staticmethod
    def json_body(response):
        """
        Return the JSON body of a response, an empty dict when it has none.

        yhub reports its errors as `{"error": ...}` and its endpoints answer
        JSON, but a failure can also come from something else on the way (a
        proxy, a gateway): what it says is a bonus, never something to fail on.
        """
        try:
            body = response.json()
        except ValueError:
            return {}

        return body if isinstance(body, dict) else {}

    def get_ydoc(self, document):
        """
        Return the current Yjs state of a document, None when it has none.

        The raw update is what `create_ydoc` takes, so the state of a document
        can be copied into another one. The built-in `ydoc` endpoint answers
        `{"doc": ...}`, the update base64 encoded, and the encoding of an empty
        document for a room it holds no content for.
        """
        response = self.request("get", self.build_url("ydoc", document))

        try:
            update = base64.b64decode(self.json_body(response)["doc"])
        except (KeyError, TypeError, ValueError) as err:
            raise APIError(
                f"The yhub API answered no readable document on {response.url}"
            ) from err

        return update if len(update) > self.empty_update_max_bytes else None

    def create_ydoc(self, document, update):
        """
        Seed the initial Yjs state of a document.

        The body is the raw binary update, what pycrdt's `get_update()`
        returns. This is not the built-in `ydoc` endpoint, which would take the
        same update base64 encoded but knows nothing of the two things this one
        is for: it is a strict create, and it attributes the content to the
        user the service is bound to rather than to the backend calling it.

        yhub answers 409 when the document already has content, 413 over 10MB
        and 400 on an update it cannot apply, all reported as an `APIError`
        carrying the status.
        """
        return self.request(
            "post",
            self.build_url("create-ydoc", document),
            data=update,
            headers={
                "Content-Type": "application/octet-stream",
                **self.build_user_header(self.user_id),
            },
        )

    def delete_ydoc(self, document):
        """
        Delete a document on the collaboration server.

        This is what stops the clients editing a deleted document: they are
        disconnected, and the collaboration server answers 404 for it from then
        on. The deletion is a soft one, its content is left untouched and
        `restore_ydoc` brings the document back whole. Erasing the content for
        good is a separate, irreversible operation that yhub deliberately does
        not expose over its REST API.

        Idempotent, and never refused: deleting a document twice keeps the date
        of the first deletion, and a document the collaboration server holds
        nothing for is recorded as deleted all the same.
        """
        return self.request("delete", self.build_url("ydoc", document))

    def restore_ydoc(self, document):
        """
        Undo the deletion of a document on the collaboration server.

        Its content was never touched, so it comes back with its whole history.
        A document that is not deleted is left alone rather than refused, which
        is what lets a restored subtree be reported without asking what became
        of each of its documents.

        yhub answers 409 for a document whose content was erased — there is
        nothing left to bring back — reported as an `APIError` carrying the
        status.
        """
        return self.request("post", self.build_url("restore-ydoc", document))

    def reset_ydoc(self, document):
        """
        Erase the content of a document on the collaboration server.

        The document itself stays: its room is emptied and left usable, as if
        it had never been written. This is what resetting a document means once
        the content lives there — deleting the room would answer 404 for a
        document that goes on existing.

        Irreversible, and it is meant to be: the editors are disconnected and
        the content is gone from the collaboration server for good, history
        included. Only the backend can ask for it.
        """
        return self.request(
            "post",
            self.build_url("reset-ydoc", document),
            headers=self.build_user_header(self.user_id),
        )

    def migrate(self, document, force=False):
        """
        Replay the legacy version history of a document into the collaboration server.

        The content of the documents used to live in our object storage, one
        version of `{id}/file` per save. yhub reads them all back and rebuilds
        the history with the timestamps of those versions, which is what makes
        its activity line up with the versions we report.

        Answers what became of the document: `ok` when this call wrote its
        history, `already` when a previous one did, `empty` when there is
        nothing in the object storage (a document born in yhub) and `nothing`
        when none of its versions could be read. All four are terminal, only a
        failure to reach yhub raises.

        Forcing a document that is already migrated attributes its content a
        second time: it is for a document whose yhub state was wiped, never for
        a retry.
        """
        url = self.build_url("migrate", document)
        response = self.request(
            "post",
            f"{url}?force=true" if force else url,
            timeout=settings.YHUB_MIGRATION_TIMEOUT,
        )

        return self.json_body(response)

    def reset_connections(self, document, user_id=None):
        """
        Re-check the access of the clients connected to a document.

        yhub re-runs the authorization of the matching connections and closes
        only the ones that lost their access, the others are left alone.
        Naming a user restricts the re-check to their own connections, which is
        what the change of a single access needs.
        """
        return self.request(
            "post",
            self.build_url("reset-connections", document),
            headers=self.build_user_header(user_id),
        )
