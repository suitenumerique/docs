"""Tests for run_indexing_view admin endpoint."""

from unittest.mock import patch

from django.http import HttpResponse

import pytest

from core import factories


@pytest.mark.usefixtures("indexer_settings")
@pytest.mark.django_db
@pytest.mark.parametrize(
    "is_authenticated,is_staff,should_call_command",
    [
        (False, False, False),
        (True, False, False),
        (True, True, True),
    ],
)
def test_run_indexing_view_post_authentication(
    client,
    is_authenticated,
    is_staff,
    should_call_command,
):
    """Test that POST to run_indexing_view requires staff authentication."""

    if is_authenticated:
        user = factories.UserFactory(is_staff=is_staff)
        client.force_login(user)

    batch_size = 100
    with patch("core.admin.call_command") as mock_call_command:
        mock_call_command.return_value = HttpResponse("Mocked render")
        response = client.post("/admin/run-indexing/", {"batch_size": batch_size})

    # redirects in all cases
    assert response.status_code == 302

    if should_call_command:
        assert "/admin/run-indexing/" == response.url
        mock_call_command.assert_called_once()
        assert mock_call_command.call_args.kwargs == {
            "batch_size": batch_size,
            "lower_time_bound": None,
            "upper_time_bound": None,
            "async_mode": True,
        }

    else:
        assert "/admin/login/" in response.url
        mock_call_command.assert_not_called()
