"""
Unit tests for the User model
"""

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
