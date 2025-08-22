"""Test user light serializer."""

import pytest

from core import factories
from core.api.serializers import UserLightSerializer

pytestmark = pytest.mark.django_db


def test_user_light_serializer():
    """Test user light serializer."""
    user = factories.UserFactory(
        email="test@test.com",
        full_name="John Doe",
        short_name="John",
    )
    serializer = UserLightSerializer(user)
    assert serializer.data["full_name"] == "John Doe"
    assert serializer.data["short_name"] == "John"


def test_user_light_serializer_no_full_name():
    """Test user light serializer without full name."""
    user = factories.UserFactory(
        email="test_foo@test.com",
        full_name=None,
        short_name="John",
    )
    serializer = UserLightSerializer(user)
    assert serializer.data["full_name"] == "test_foo"
    assert serializer.data["short_name"] == "John"


def test_user_light_serializer_no_short_name():
    """Test user light serializer without short name."""
    user = factories.UserFactory(
        email="test_foo@test.com",
        full_name=None,
        short_name=None,
    )
    serializer = UserLightSerializer(user)
    assert serializer.data["full_name"] == "test_foo"
    assert serializer.data["short_name"] == "test_foo"
