"""
Unit tests for the parse_http_conditional_headers utility function.
"""

import datetime as dt

import pytest
from rest_framework.test import APIRequestFactory

from core.api.utils import parse_http_conditional_headers


@pytest.fixture(name="prepare_request")
def fixture_prepare_request(request):
    """
    Fixture returning a request with headers configured from the indirect parametrize parameters.
    """
    return APIRequestFactory().get("/", headers=request.param)


@pytest.mark.parametrize(
    "prepare_request, expected_if_none_match, expected_if_modified_since",
    [
        ({}, None, None),
        ({"if-none-match": '"abc123"'}, '"abc123"', None),
        ({"if-none-match": 'W/"abc123"'}, '"abc123"', None),
        (
            {"if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT"},
            None,
            dt.datetime(2015, 10, 21, 7, 28, 0, tzinfo=dt.timezone.utc),
        ),
        ({"if-modified-since": "not-a-date"}, None, None),
        (
            {
                "if-none-match": 'W/"deadbeef"',
                "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
            },
            '"deadbeef"',
            dt.datetime(2015, 10, 21, 7, 28, 0, tzinfo=dt.timezone.utc),
        ),
    ],
    indirect=["prepare_request"],
)
def test_api_utils_parse_http_conditional_headers(
    prepare_request, expected_if_none_match, expected_if_modified_since
):
    """Test parse_http_conditional_headers utils."""
    if_none_match, if_modified_since_dt = parse_http_conditional_headers(
        prepare_request
    )
    assert if_none_match == expected_if_none_match
    assert if_modified_since_dt == expected_if_modified_since
