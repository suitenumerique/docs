"""Test the serving of the files collected in STATIC_ROOT."""

import pytest

from core.tests.utils.urls import reload_urls

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def static_root(settings, tmp_path):
    """Point STATIC_ROOT to a directory holding a single collected file."""
    static_file = tmp_path / "admin" / "css" / "login.css"
    static_file.parent.mkdir(parents=True)
    static_file.write_text("body {}", encoding="utf-8")

    settings.STATIC_ROOT = str(tmp_path)

    yield tmp_path

    # The URLs are built from the settings, so restore the settings and reload
    # them to leave the URLs as the next tests expect them.
    settings.finalize()
    reload_urls()


def test_urls_static_served(client, settings):
    """Collected static files are served, the admin has no assets otherwise."""
    settings.SERVE_STATIC_FILES = True
    reload_urls()

    response = client.get("/static/admin/css/login.css")

    assert response.status_code == 200
    assert b"".join(response.streaming_content) == b"body {}"


def test_urls_static_unknown_file(client, settings):
    """A file missing from STATIC_ROOT is a 404."""
    settings.SERVE_STATIC_FILES = True
    reload_urls()

    response = client.get("/static/admin/css/unknown.css")

    assert response.status_code == 404


def test_urls_static_disabled(client, settings):
    """Serving static files can be delegated to a web server or a CDN."""
    settings.SERVE_STATIC_FILES = False
    reload_urls()

    response = client.get("/static/admin/css/login.css")

    assert response.status_code == 404
