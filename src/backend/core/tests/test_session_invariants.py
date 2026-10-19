"""
Test the session-related invariants of the Impress core app.

`ForceSessionMiddleware` used to create a session for every anonymous request,
which forced the probes to be exempted (commits 1e61b4a78 and 0b8808f9a). The
middleware is gone: pin the invariant that probe requests create no session and
receive no session cookie.
"""

from unittest.mock import patch

from django.contrib.sessions.backends.cache import SessionStore

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("path", ["/__heartbeat__", "/__lbheartbeat__"])
def test_probes_get_no_session_nor_cookie(path):
    """Probe requests answer 200 without touching the session store."""
    with (
        patch.object(SessionStore, "create") as mock_create,
        patch.object(SessionStore, "load") as mock_load,
    ):
        response = APIClient().get(path)

    assert response.status_code == 200
    mock_create.assert_not_called()
    mock_load.assert_not_called()
    assert "docs_sessionid" not in response.cookies
