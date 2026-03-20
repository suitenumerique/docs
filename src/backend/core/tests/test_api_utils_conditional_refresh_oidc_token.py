"""module testing the conditional_refresh_oidc_token utils."""

from unittest import mock

from core.api import utils


def test_refresh_oidc_access_token_storing_refresh_token_disabled(settings):
    """The method_decorator must not be called when OIDC_STORE_REFRESH_TOKEN is False."""

    settings.OIDC_STORE_REFRESH_TOKEN = False

    callback = mock.MagicMock()

    with mock.patch.object(utils, "method_decorator") as mock_method_decorator:
        result = utils.conditional_refresh_oidc_token(callback)

    mock_method_decorator.assert_not_called()
    assert result == callback


def test_refresh_oidc_access_token_storing_refresh_token_enabled(settings):
    """The method_decorator must not be called when OIDC_STORE_REFRESH_TOKEN is False."""

    settings.OIDC_STORE_REFRESH_TOKEN = True

    callback = mock.MagicMock()

    with mock.patch.object(utils, "method_decorator") as mock_method_decorator:
        utils.conditional_refresh_oidc_token(callback)

    mock_method_decorator.assert_called_with(utils.refresh_oidc_access_token)
