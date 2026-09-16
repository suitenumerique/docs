from datetime import timedelta


FREQUENCY_DELAYS = {
    "immediate": timedelta(0),
    "hourly": timedelta(hours=1),
    "daily": timedelta(days=1),
    "weekly": timedelta(weeks=1),
}


def should_send_notification(frequency, last_sent_at, now):
    if frequency not in FREQUENCY_DELAYS:
        raise ValueError(f"Unknown notification frequency: {frequency}")

    if frequency == "immediate" or last_sent_at is None:
        return True

    return now - last_sent_at >= FREQUENCY_DELAYS[frequency]
