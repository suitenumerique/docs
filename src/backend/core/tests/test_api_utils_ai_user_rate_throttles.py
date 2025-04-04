"""
Test throttling on users for the AI endpoint.
"""

from unittest.mock import patch
from uuid import uuid4

from django.test import override_settings

import pytest
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from core.api.utils import AIUserRateThrottle
from core.factories import UserFactory

pytestmark = pytest.mark.django_db


class DocumentAPIView(APIView):
    """A simple view to test the throttle"""

    throttle_classes = [AIUserRateThrottle]

    def get(self, request, *args, **kwargs):
        """Minimal get method for testing purposes."""
        return Response({"message": "Success"})


@override_settings(AI_USER_RATE_THROTTLE_RATES={"minute": 3, "hour": 6, "day": 10})
@patch("time.time")
def test_api_utils_ai_user_rate_throttle_minute_limit(mock_time):
    """Test that minute limit is enforced."""
    user = UserFactory()
    api_rf = APIRequestFactory()
    mock_time.return_value = 1000000

    # Simulate requests to the document API
    for _i in range(3):  # 3 first requests should be allowed
        document_id = str(uuid4())
        request = api_rf.get(f"/documents/{document_id:s}/")
        request.user = user
        response = DocumentAPIView.as_view()(request, pk=document_id)
        assert response.status_code == 200

    # Simulate passage of time
    mock_time.return_value += 59

    # 4th request should be throttled
    document_id = str(uuid4())
    request = api_rf.get(f"/documents/{document_id:s}/")
    request.user = user
    response = DocumentAPIView.as_view()(request, pk=document_id)
    assert response.status_code == 429

    # After the 60s backoff wait time has passed, we can make a request again
    mock_time.return_value += 1

    document_id = str(uuid4())
    request = api_rf.get(f"/documents/{document_id:s}/")
    request.user = user
    response = DocumentAPIView.as_view()(request, pk=document_id)
    assert response.status_code == 200


@override_settings(AI_USER_RATE_THROTTLE_RATES={"minute": 100000, "hour": 6, "day": 10})
@patch("time.time")
def test_ai_user_rate_throttle_hour_limit(mock_time):
    """Test that the hour limit is enforced without hitting the minute limit."""
    user = UserFactory()
    api_rf = APIRequestFactory()
    mock_time.return_value = 1000000

    # Make requests to the document API, one per 21 seconds to avoid hitting the minute limit
    for _i in range(6):
        document_id = str(uuid4())
        request = api_rf.get(f"/documents/{document_id:s}/")
        request.user = user
        response = DocumentAPIView.as_view()(request, pk=document_id)
        assert response.status_code == 200

        # Simulate passage of time
        mock_time.return_value += 21

    # Simulate passage of time
    mock_time.return_value += 3600 - 6 * 21 - 1

    # 7th request should be throttled
    request = api_rf.get(f"/documents/{document_id:s}/")
    request.user = user
    response = DocumentAPIView.as_view()(request, pk=document_id)
    assert response.status_code == 429

    # After the 1h backoff wait time has passed, we can make a request again
    mock_time.return_value += 1

    request = api_rf.get(f"/documents/{document_id:s}/")
    request.user = user
    response = DocumentAPIView.as_view()(request, pk=document_id)
    assert response.status_code == 200


@override_settings(AI_USER_RATE_THROTTLE_RATES={"minute": 3, "hour": 6, "day": 10})
@patch("time.time")
def test_api_utils_ai_user_rate_throttle_day_limit(mock_time):
    """Test that day limit is enforced."""
    user = UserFactory()
    api_rf = APIRequestFactory()
    mock_time.return_value = 1000000

    # Make requests to the document API, one per 10 minutes to avoid hitting
    # the minute and hour limits
    for _i in range(10):  # 10 requests should be allowed
        document_id = str(uuid4())
        request = api_rf.get(f"/documents/{document_id:s}/")
        request.user = user
        response = DocumentAPIView.as_view()(request, pk=document_id)
        assert response.status_code == 200

        # Simulate passage of time
        mock_time.return_value += 60 * 10

    # Simulate passage of time
    mock_time.return_value += 24 * 3600 - 10 * 60 * 10 - 1

    # 11th request should be throttled
    request = api_rf.get(f"/documents/{document_id:s}/")
    request.user = user
    response = DocumentAPIView.as_view()(request, pk=document_id)
    assert response.status_code == 429

    # After the 24h backoff wait time has passed we can make a request again
    mock_time.return_value += 1

    request = api_rf.get(f"/documents/{document_id:s}/")
    request.user = user
    response = DocumentAPIView.as_view()(request, pk=document_id)
    assert response.status_code == 200
