"""Config services."""

import logging

from django.conf import settings

import requests

logger = logging.getLogger(__name__)


def debug_enabled(namespace: str | None) -> bool:
    """
    Quick way to check if debug is enabled for a specific namespace
    If no namespace is passed it just returns the value of settings.DEBUG
    """
    if not namespace:
        return getattr(settings, "DEBUG", False)

    if False is getattr(settings, "DEBUG", False):
        return False

    return namespace in getattr(settings, "DEBUG_NAMESPACES", [])


def get_json_from_url(json_url: str) -> dict:
    """
    Fetches JSON from the given URL."
    """
    try:
        response = requests.get(
            json_url, timeout=5, headers={"User-Agent": "Docs-Application"}
        )
        response.raise_for_status()

        return response.json()
    except (requests.RequestException, ValueError) as e:
        logger.error("Failed to fetch JSON: %s", e)
        return {}
