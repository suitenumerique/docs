"""
Tests for Find search feature flags
"""

from unittest import mock

from django.http import HttpResponse

import pytest
import responses
from rest_framework.test import APIClient
from waffle.testutils import override_flag

from core.enums import FeatureFlag, SearchType
from core.services.search_indexers import get_document_indexer

pytestmark = pytest.mark.django_db


@responses.activate
@mock.patch("core.api.viewsets.DocumentViewSet._title_search")
@mock.patch("core.api.viewsets.DocumentViewSet._search_with_indexer")
@pytest.mark.parametrize(
    "activated_flags,"
    "expected_search_type,"
    "expected_search_with_indexer_called,"
    "expected_title_search_called",
    [
        ([], SearchType.TITLE, False, True),
        ([FeatureFlag.FLAG_FIND_HYBRID_SEARCH], SearchType.HYBRID, True, False),
        (
            [
                FeatureFlag.FLAG_FIND_HYBRID_SEARCH,
                FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH,
            ],
            SearchType.HYBRID,
            True,
            False,
        ),
        ([FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH], SearchType.FULL_TEXT, True, False),
    ],
)
# pylint: disable=too-many-arguments, too-many-positional-arguments
def test_api_documents_search_success(  # noqa : PLR0913
    mock_search_with_indexer,
    mock_title_search,
    activated_flags,
    expected_search_type,
    expected_search_with_indexer_called,
    expected_title_search_called,
):
    """
    Test that the API endpoint for searching documents returns a successful response
    with the expected search type according to the activated feature flags,
    and that the appropriate search method is called.
    """
    assert get_document_indexer() is not None

    mock_search_with_indexer.return_value = HttpResponse()
    mock_title_search.return_value = HttpResponse()

    with override_flag(
        FeatureFlag.FLAG_FIND_HYBRID_SEARCH,
        active=FeatureFlag.FLAG_FIND_HYBRID_SEARCH in activated_flags,
    ):
        with override_flag(
            FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH,
            active=FeatureFlag.FLAG_FIND_FULL_TEXT_SEARCH in activated_flags,
        ):
            response = APIClient().get(
                "/api/v1.0/documents/search/", data={"q": "alpha"}
            )

    assert response.status_code == 200

    if expected_search_with_indexer_called:
        mock_search_with_indexer.assert_called_once()
        assert (
            mock_search_with_indexer.call_args.kwargs["search_type"]
            == expected_search_type
        )
    else:
        assert not mock_search_with_indexer.called

    if expected_title_search_called:
        assert SearchType.TITLE == expected_search_type
        mock_title_search.assert_called_once()
    else:
        assert not mock_title_search.called
