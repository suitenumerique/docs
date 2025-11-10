"""Collaboration services."""

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

import requests


class CollaborationService:
    """Service class for Collaboration related operations."""

    def __init__(self):
        """Ensure that the collaboration configuration is set properly."""
        if settings.COLLABORATION_API_URL is None:
            raise ImproperlyConfigured("Collaboration configuration not set")

    def reset_connections(self, room, user_id=None):
        """
        Reset connections of a room in the collaboration server.
        Resetting a connection means that the user will be disconnected and will
        have to reconnect to the collaboration server, with updated rights.
        """
        endpoint = "reset-connections"

        # room is necessary as a parameter, it is easier to stick to the
        # same pod thanks to a parameter
        endpoint_url = f"{settings.COLLABORATION_API_URL}{endpoint}/?room={room}"

        # Note: Collaboration microservice accepts only raw token, which is not recommended
        headers = {"Authorization": settings.COLLABORATION_SERVER_SECRET}
        if user_id:
            headers["X-User-Id"] = user_id

        try:
            response = requests.post(endpoint_url, headers=headers, timeout=10)
        except requests.RequestException as e:
            raise requests.HTTPError("Failed to notify WebSocket server.") from e

        if response.status_code != 200:
            raise requests.HTTPError(
                f"Failed to notify WebSocket server. Status code: {response.status_code}, "
                f"Response: {response.text}"
            )

    def get_document_connection_info(self, room, session_key):
        """
        Get the connection info for a document.
        """
        endpoint = "get-connections"
        querystring = {
            "room": room,
            "sessionKey": session_key,
        }
        endpoint_url = f"{settings.COLLABORATION_API_URL}{endpoint}/"

        headers = {"Authorization": settings.COLLABORATION_SERVER_SECRET}

        try:
            response = requests.get(
                endpoint_url, headers=headers, params=querystring, timeout=10
            )
        except requests.RequestException as e:
            raise requests.HTTPError("Failed to get document connection info.") from e

        if response.status_code == 200:
            result = response.json()
            return result.get("count", 0), result.get("exists", False)

        if response.status_code == 404:
            return 0, False

        raise requests.HTTPError(
            f"Failed to get document connection info. Status code: {response.status_code}, "
            f"Response: {response.text}"
        )
