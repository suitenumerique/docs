"""
Test the ForceSessionMiddleware of the Impress core app.
"""

from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.cache import SessionStore
from django.test import RequestFactory

import pytest
from rest_framework.test import APIClient

from core import factories
from core.middleware import ForceSessionMiddleware

pytestmark = pytest.mark.django_db


def _process(path, user):
    """Run the middleware on a request for `path` and return the request."""
    request = RequestFactory().get(path)
    request.user = user
    request.session = SessionStore()
    ForceSessionMiddleware(lambda req: None).process_request(request)
    return request


def test_middleware_force_session_anonymous_creates_session():
    """An anonymous request on a regular path gets a session created."""
    request = _process("/api/v1.0/config/", AnonymousUser())
    assert request.session.session_key is not None


def test_middleware_force_session_authenticated_does_not_create_session():
    """An authenticated request does not get a new session forced on it."""
    request = _process("/api/v1.0/config/", factories.UserFactory())
    assert request.session.session_key is None


@pytest.mark.parametrize("path", ["/__lbheartbeat__", "/__lbheartbeat__/"])
def test_middleware_force_session_liveness_probe_skips_session(path):
    """
    The liveness probe must never create a session nor load one: it has to keep
    answering when the session backend is unavailable.
    """
    with (
        patch.object(SessionStore, "create") as mock_create,
        patch.object(SessionStore, "load") as mock_load,
    ):
        request = _process(path, AnonymousUser())

    mock_create.assert_not_called()
    mock_load.assert_not_called()
    assert request.session.session_key is None


def test_middleware_force_session_readiness_probe_end_to_end():
    """A readiness probe request answers 200 without touching the session store."""
    client = APIClient()

    with (
        patch.object(SessionStore, "create") as mock_create,
        patch.object(SessionStore, "load") as mock_load,
    ):
        response = client.get("/__heartbeat__")

    assert response.status_code == 200
    mock_create.assert_not_called()
    mock_load.assert_not_called()
    assert "docs_sessionid" not in response.cookies


@pytest.mark.parametrize("path", ["/__heartbeat__", "/__heartbeat__/"])
def test_middleware_force_session_readiness_probe_skips_session(path):
    """
    The readiness probe must never create a session nor load one: it has to keep
    answering when the session backend is unavailable.
    """
    with (
        patch.object(SessionStore, "create") as mock_create,
        patch.object(SessionStore, "load") as mock_load,
    ):
        request = _process(path, AnonymousUser())

    mock_create.assert_not_called()
    mock_load.assert_not_called()
    assert request.session.session_key is None


def test_middleware_force_session_liveness_probe_end_to_end():
    """A liveness probe request answers 200 without touching the session store."""
    client = APIClient()

    with (
        patch.object(SessionStore, "create") as mock_create,
        patch.object(SessionStore, "load") as mock_load,
    ):
        response = client.get("/__lbheartbeat__")

    assert response.status_code == 200
    mock_create.assert_not_called()
    mock_load.assert_not_called()
    assert "docs_sessionid" not in response.cookies


def test_middleware_force_session_anonymous_end_to_end_still_gets_cookie():
    """A regular anonymous request still receives a session cookie."""
    client = APIClient()

    response = client.get("/api/v1.0/config/")

    assert response.status_code == 200
    assert "docs_sessionid" in response.cookies
