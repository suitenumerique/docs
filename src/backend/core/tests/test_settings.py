"""
Unit tests for the User model
"""

import os
import tempfile

import pytest

from impress.settings import Base


def test_invalid_settings_oidc_email_configuration():
    """
    The OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION and OIDC_ALLOW_DUPLICATE_EMAILS settings
    should not be both set to True simultaneously.
    """

    class TestSettings(Base):
        """Fake test settings."""

        OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION = True
        OIDC_ALLOW_DUPLICATE_EMAILS = True

    # The validation is performed during post_setup
    with pytest.raises(ValueError) as excinfo:
        TestSettings().post_setup()

    # Check the exception message
    assert str(excinfo.value) == (
        "Both OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION and "
        "OIDC_ALLOW_DUPLICATE_EMAILS cannot be set to True simultaneously. "
    )


def test_settings_psycopg_pool_not_enabled():
    """
    Test that not changing DB_PSYCOPG_POOL_ENABLED should not configure psycopg in the DATABASES
    settings.
    """

    class TestSettings(Base):
        """Fake test settings without enabling psycopg"""

    TestSettings.post_setup()

    assert TestSettings.DATABASES["default"].get("OPTIONS") == {}


def test_settings_psycopg_pool_enabled(monkeypatch):
    """
    Test when DB_PSYCOPG_POOL_ENABLED is set to True, the psycopg pool options should be present
    in the DATABASES OPTIONS.
    """

    monkeypatch.setenv("DB_PSYCOPG_POOL_ENABLED", "True")

    class TestSettings(Base):
        """Fake test settings without enabling psycopg"""

    TestSettings.post_setup()

    assert TestSettings.DATABASES["default"].get("OPTIONS") == {
        "pool": {
            "min_size": 4,
            "max_size": None,
            "timeout": 3,
        }
    }


PROMETHEUS_AUTH_MIDDLEWARE = "core.middleware.PrometheusAuthMiddleware"
PROMETHEUS_BEFORE_MIDDLEWARE = "django_prometheus.middleware.PrometheusBeforeMiddleware"
PROMETHEUS_AFTER_MIDDLEWARE = "django_prometheus.middleware.PrometheusAfterMiddleware"


def _prometheus_settings(**attributes):
    """
    Build fake settings enabling the metrics.

    post_setup edits the lists and the database in place, which is the only way for Django
    to see the change: copies keep it away from the settings the other tests run with.
    """
    return type(
        "TestSettings",
        (Base,),
        {
            "PROMETHEUS_METRICS_ENABLED": True,
            "PROMETHEUS_API_KEY": "a-key",
            "INSTALLED_APPS": list(Base.INSTALLED_APPS),
            "MIDDLEWARE": list(Base.MIDDLEWARE),
            "DATABASES": {"default": {"ENGINE": "django.db.backends.postgresql"}},
            **attributes,
        },
    )


def test_settings_prometheus_metrics_not_enabled(monkeypatch):
    """django-prometheus should be absent from the settings unless it is asked for."""
    monkeypatch.delenv("PROMETHEUS_MULTIPROC_DIR", raising=False)

    class TestSettings(Base):
        """Fake test settings without enabling the metrics."""

    TestSettings.post_setup()

    assert "django_prometheus" not in TestSettings.INSTALLED_APPS
    assert PROMETHEUS_AUTH_MIDDLEWARE not in TestSettings.MIDDLEWARE
    assert PROMETHEUS_BEFORE_MIDDLEWARE not in TestSettings.MIDDLEWARE
    assert PROMETHEUS_AFTER_MIDDLEWARE not in TestSettings.MIDDLEWARE
    assert "PROMETHEUS_MULTIPROC_DIR" not in os.environ


@pytest.mark.parametrize("api_key", [None, ""])
def test_settings_prometheus_metrics_enabled_requires_api_key(
    monkeypatch, tmp_path, api_key
):
    """Enabling the metrics without a key should be refused: they would be public."""
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", str(tmp_path))
    test_settings = _prometheus_settings(PROMETHEUS_API_KEY=api_key)

    with pytest.raises(ValueError) as excinfo:
        test_settings.post_setup()

    assert str(excinfo.value) == (
        "PROMETHEUS_METRICS_ENABLED requires PROMETHEUS_API_KEY to be set."
    )
    assert PROMETHEUS_BEFORE_MIDDLEWARE not in test_settings.MIDDLEWARE


def test_settings_prometheus_metrics_enabled(monkeypatch, tmp_path):
    """
    Enabling the metrics should create the directory and hand it to prometheus_client,
    install the application, wrap the middlewares and instrument the database.
    """
    multiproc_dir = tmp_path / "prometheus"
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", "overwritten-below")
    test_settings = _prometheus_settings(PROMETHEUS_MULTIPROC_DIR=str(multiproc_dir))
    installed_apps = test_settings.INSTALLED_APPS
    middleware = test_settings.MIDDLEWARE
    default_database = test_settings.DATABASES["default"]

    test_settings.post_setup()

    assert multiproc_dir.is_dir()
    assert multiproc_dir.stat().st_mode & 0o777 == 0o700
    assert os.environ["PROMETHEUS_MULTIPROC_DIR"] == str(multiproc_dir)

    # the very objects Django was handed before post_setup ran
    assert test_settings.INSTALLED_APPS is installed_apps
    assert test_settings.MIDDLEWARE is middleware
    assert test_settings.DATABASES["default"] is default_database

    assert installed_apps[-1] == "django_prometheus"
    # the authentication first: a refused scrape must not reach anything else
    assert middleware[0] == PROMETHEUS_AUTH_MIDDLEWARE
    assert middleware[1] == PROMETHEUS_BEFORE_MIDDLEWARE
    assert middleware[-1] == PROMETHEUS_AFTER_MIDDLEWARE
    assert middleware[2:-1] == Base.MIDDLEWARE
    assert default_database["ENGINE"] == "django_prometheus.db.backends.postgresql"

    # running it again must not wrap the middlewares a second time
    test_settings.post_setup()
    assert installed_apps.count("django_prometheus") == 1
    assert middleware.count(PROMETHEUS_AUTH_MIDDLEWARE) == 1
    assert middleware.count(PROMETHEUS_BEFORE_MIDDLEWARE) == 1
    assert middleware.count(PROMETHEUS_AFTER_MIDDLEWARE) == 1


def test_settings_prometheus_multiproc_dir_default(monkeypatch, tmp_path):
    """
    Without a directory, a fixed one should be used: every uvicorn worker computes it on
    its own and they have to agree.
    """
    # set then unset, so that what post_setup writes to the environment is undone
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", "unset-below")
    monkeypatch.delenv("PROMETHEUS_MULTIPROC_DIR")
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    expected = tmp_path / f"impress-prometheus-{os.getuid()}"

    _prometheus_settings().post_setup()
    assert os.environ["PROMETHEUS_MULTIPROC_DIR"] == str(expected)
    assert expected.is_dir()

    _prometheus_settings().post_setup()
    assert os.environ["PROMETHEUS_MULTIPROC_DIR"] == str(expected)


def test_settings_prometheus_multiproc_dir_must_not_be_a_link(monkeypatch, tmp_path):
    """A link planted in a shared temporary directory should not be followed."""
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", "unset-below")
    monkeypatch.delenv("PROMETHEUS_MULTIPROC_DIR")
    target = tmp_path / "elsewhere"
    target.mkdir()
    link = tmp_path / "link"
    link.symlink_to(target, target_is_directory=True)

    with pytest.raises(ValueError, match="must be a directory owned by the user"):
        _prometheus_settings(PROMETHEUS_MULTIPROC_DIR=str(link)).post_setup()

    assert "PROMETHEUS_MULTIPROC_DIR" not in os.environ


def test_settings_prometheus_db_metrics_can_be_disabled(monkeypatch, tmp_path):
    """The database engine should be left alone when its metrics are not wanted."""
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", "overwritten-below")
    test_settings = _prometheus_settings(
        PROMETHEUS_MULTIPROC_DIR=str(tmp_path), PROMETHEUS_DB_METRICS_ENABLED=False
    )

    test_settings.post_setup()

    assert (
        test_settings.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"
    )
