"""The load-test tooling must only ever be reachable with the `LoadTest` configuration."""

import inspect

from django.core.exceptions import ImproperlyConfigured

import pytest
from configurations import Configuration

from impress import settings as project_settings
from impress.settings import Base, LoadTest, Production
from loadtest.apps import LoadTestConfig

CONFIGURATIONS = [
    configuration
    for _, configuration in inspect.getmembers(project_settings, inspect.isclass)
    if issubclass(configuration, Configuration) and configuration is not Configuration
]


def test_loadtest_settings_every_configuration_is_checked():
    """Guard the two tests below against a list that would silently be empty."""
    names = {configuration.__name__ for configuration in CONFIGURATIONS}
    assert {
        "Base",
        "Development",
        "Test",
        "Production",
        "PreProduction",
        "LoadTest",
    } <= (names)


@pytest.mark.parametrize(
    "configuration",
    [
        configuration
        for configuration in CONFIGURATIONS
        if configuration is not LoadTest
    ],
    ids=lambda configuration: configuration.__name__,
)
def test_loadtest_settings_disabled_everywhere_else(configuration):
    """No other configuration installs the application or enables its setting."""
    assert configuration.LOAD_TEST_TOOLS_ENABLED is False
    assert "loadtest" not in configuration.INSTALLED_APPS


def test_loadtest_settings_production_pins_it_off():
    """Production says so itself, rather than inheriting whatever `Base` says."""
    assert vars(Production)["LOAD_TEST_TOOLS_ENABLED"] is False


def test_loadtest_settings_not_read_from_the_environment(monkeypatch):
    """No environment variable should be able to turn it on."""
    monkeypatch.setenv("LOAD_TEST_TOOLS_ENABLED", "True")
    monkeypatch.setenv("DJANGO_LOAD_TEST_TOOLS_ENABLED", "True")

    class TestSettings(Production):
        """A production configuration set up with the variables above."""

    assert TestSettings.LOAD_TEST_TOOLS_ENABLED is False
    assert Base.LOAD_TEST_TOOLS_ENABLED is False


def test_loadtest_settings_load_test_configuration():
    """`LoadTest` is production plus the application, on a list of its own."""
    assert issubclass(LoadTest, Production)
    assert LoadTest.LOAD_TEST_TOOLS_ENABLED is True
    # A copy taken when the class is defined. Not compared for equality: the
    # `Test` and `Development` configurations append to the shared list of `Base`
    # in place when they are instantiated, which a copy is precisely immune to.
    assert LoadTest.INSTALLED_APPS is not Base.INSTALLED_APPS
    assert LoadTest.INSTALLED_APPS[-1] == "loadtest"
    assert LoadTest.INSTALLED_APPS.count("loadtest") == 1
    assert set(LoadTest.INSTALLED_APPS[:-1]) <= set(Production.INSTALLED_APPS)
    assert "core" in LoadTest.INSTALLED_APPS


def test_loadtest_app_refuses_to_load_when_disabled(settings):
    """Installing the application elsewhere should stop the process from starting."""
    settings.LOAD_TEST_TOOLS_ENABLED = False
    config = LoadTestConfig.create("loadtest")

    with pytest.raises(ImproperlyConfigured, match="LOAD_TEST_TOOLS_ENABLED"):
        config.ready()


@pytest.mark.usefixtures("load_test_enabled")
def test_loadtest_app_loads_when_enabled():
    """The application loads with the `LoadTest` configuration."""
    LoadTestConfig.create("loadtest").ready()
