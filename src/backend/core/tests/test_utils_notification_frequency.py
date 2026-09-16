from datetime import datetime, timedelta

import pytest

from core.utils.notification_frequency import should_send_notification


NOW = datetime(2026, 1, 8, 12, 0, 0)


def test_invalid_frequency_raises_value_error():
    with pytest.raises(ValueError, match="Unknown notification frequency: monthly"):
        should_send_notification("monthly", None, NOW)


def test_notification_is_sent_without_previous_send():
    for frequency in ("immediate", "hourly", "daily", "weekly"):
        assert should_send_notification(frequency, None, NOW) is True


def test_immediate_frequency_returns_true():
    assert should_send_notification("immediate", NOW, NOW) is True


@pytest.mark.parametrize(
    ("frequency", "delay"),
    [
        ("hourly", timedelta(hours=1)),
        ("daily", timedelta(days=1)),
        ("weekly", timedelta(weeks=1)),
    ],
)
def test_notification_is_sent_at_frequency_threshold(frequency, delay):
    assert should_send_notification(frequency, NOW - delay, NOW) is True
    assert should_send_notification(frequency, NOW - delay + timedelta(seconds=1), NOW) is False
