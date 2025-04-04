"""Config services."""

import logging

import requests

logger = logging.getLogger(__name__)


def get_footer_json(footer_json_url: str) -> dict:
    """
    Fetches the footer JSON from the given URL."
    """
    try:
        response = requests.get(
            footer_json_url, timeout=5, headers={"User-Agent": "Docs-Application"}
        )
        response.raise_for_status()

        footer_json = response.json()

        return footer_json
    except (requests.RequestException, ValueError) as e:
        logger.error("Failed to fetch footer JSON: %s", e)
        return {}
