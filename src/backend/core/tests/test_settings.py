"""Unit tests for settings helpers."""

import pytest

from django.core.exceptions import ImproperlyConfigured

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


def test_wrap_backend_with_prometheus_importable_path():
    """
    When Prometheus exporter is enabled, known DB backends are swapped to their
    Prometheus equivalents.
    """

    class TestSettings(Base):
        PROMETHEUS_EXPORTER_ENABLED = True
        MONITORING_BASIC_AUTH_USERNAME = "monitoring"
        MONITORING_BASIC_AUTH_PASSWORD = "monitoring"
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
            }
        }

    settings = TestSettings()
    settings.post_setup()
    assert (
        settings.DATABASES["default"]["ENGINE"]
        == "django_prometheus.db.backends.sqlite3"
    )


def test_wrap_backend_with_prometheus_redis_cache():
    """
    Redis cache backend should map to its Prometheus-instrumented equivalent.
    """

    class TestSettings(Base):
        PROMETHEUS_EXPORTER_ENABLED = True
        MONITORING_BASIC_AUTH_USERNAME = "monitoring"
        MONITORING_BASIC_AUTH_PASSWORD = "monitoring"
        CACHES = {
            "default": {
                "BACKEND": "django_redis.cache.RedisCache",
            },
        }

    settings = TestSettings()
    settings.post_setup()
    assert (
        settings.CACHES["default"]["BACKEND"]
        == "django_prometheus.cache.backends.redis.RedisCache"
    )


def test_wrap_backend_with_prometheus_missing_instrumentation():
    """
    Unknown cache backends stay untouched when Prometheus exporter is enabled.
    """

    class TestSettings(Base):
        PROMETHEUS_EXPORTER_ENABLED = True
        MONITORING_BASIC_AUTH_USERNAME = "monitoring"
        MONITORING_BASIC_AUTH_PASSWORD = "monitoring"
        CACHES = {
            "default": {
                "BACKEND": "custom.cache.backends.missing.Backend",
            },
        }

    settings = TestSettings()
    settings.post_setup()
    assert (
        settings.CACHES["default"]["BACKEND"]
        == "custom.cache.backends.missing.Backend"
    )


def test_prometheus_requires_basic_auth_credentials():
    """
    Enabling the exporter without credentials should be rejected.
    """

    class TestSettings(Base):
        PROMETHEUS_EXPORTER_ENABLED = True
        MONITORING_BASIC_AUTH_USERNAME = ""
        MONITORING_BASIC_AUTH_PASSWORD = ""

    with pytest.raises(ImproperlyConfigured) as excinfo:
        TestSettings().post_setup()

    assert "MONITORING_BASIC_AUTH_USERNAME and MONITORING_BASIC_AUTH_PASSWORD" in str(
        excinfo.value
    )
