"""Util to generate S3 authorization headers for object storage access control"""

import time
from abc import ABC, abstractmethod

from django.conf import settings
from django.core.cache import cache
from django.core.files.storage import default_storage

import botocore
from rest_framework.throttling import BaseThrottle


def nest_tree(flat_list, steplen):
    """
    Convert a flat list of serialized documents into a nested tree making advantage
    of the`path` field and its step length.
    """
    node_dict = {}
    roots = []

    # Sort the flat list by path to ensure parent nodes are processed first
    flat_list.sort(key=lambda x: x["path"])

    for node in flat_list:
        node["children"] = []  # Initialize children list
        node_dict[node["path"]] = node

        # Determine parent path
        parent_path = node["path"][:-steplen]

        if parent_path in node_dict:
            node_dict[parent_path]["children"].append(node)
        else:
            roots.append(node)  # Collect root nodes

    if len(roots) > 1:
        raise ValueError("More than one root element detected.")

    return roots[0] if roots else None


def filter_root_paths(paths, skip_sorting=False):
    """
    Filters root paths from a list of paths representing a tree structure.
    A root path is defined as a path that is not a prefix of any other path.

    Args:
        paths (list of str): The list of paths.

    Returns:
        list of str: The filtered list of root paths.
    """
    if not skip_sorting:
        paths.sort()

    root_paths = []
    for path in paths:
        # If the current path is not a prefix of the last added root path, add it
        if not root_paths or not path.startswith(root_paths[-1]):
            root_paths.append(path)

    return root_paths


def generate_s3_authorization_headers(key):
    """
    Generate authorization headers for an s3 object.
    These headers can be used as an alternative to signed urls with many benefits:
    - the urls of our files never expire and can be stored in our documents' content
    - we don't leak authorized urls that could be shared (file access can only be done
      with cookies)
    - access control is truly realtime
    - the object storage service does not need to be exposed on internet
    """
    url = default_storage.unsigned_connection.meta.client.generate_presigned_url(
        "get_object",
        ExpiresIn=0,
        Params={"Bucket": default_storage.bucket_name, "Key": key},
    )
    request = botocore.awsrequest.AWSRequest(method="get", url=url)

    s3_client = default_storage.connection.meta.client
    # pylint: disable=protected-access
    credentials = s3_client._request_signer._credentials  # noqa: SLF001
    frozen_credentials = credentials.get_frozen_credentials()
    region = s3_client.meta.region_name
    auth = botocore.auth.S3SigV4Auth(frozen_credentials, "s3", region)
    auth.add_auth(request)

    return request


class AIBaseRateThrottle(BaseThrottle, ABC):
    """Base throttle class for AI-related rate limiting with backoff."""

    def __init__(self, rates):
        """Initialize instance attributes with configurable rates."""
        super().__init__()
        self.rates = rates
        self.cache_key = None
        self.recent_requests_minute = 0
        self.recent_requests_hour = 0
        self.recent_requests_day = 0

    @abstractmethod
    def get_cache_key(self, request, view):
        """Abstract method to generate cache key for throttling."""

    def allow_request(self, request, view):
        """Check if the request is allowed based on rate limits."""
        self.cache_key = self.get_cache_key(request, view)
        if not self.cache_key:
            return True  # Allow if no cache key is generated

        now = time.time()
        history = cache.get(self.cache_key, [])
        # Keep requests within the last 24 hours
        history = [req for req in history if req > now - 86400]

        # Calculate recent requests
        self.recent_requests_minute = len([req for req in history if req > now - 60])
        self.recent_requests_hour = len([req for req in history if req > now - 3600])
        self.recent_requests_day = len(history)

        # Check rate limits
        if self.recent_requests_minute >= self.rates["minute"]:
            return False
        if self.recent_requests_hour >= self.rates["hour"]:
            return False
        if self.recent_requests_day >= self.rates["day"]:
            return False

        # Log the request
        history.append(now)
        cache.set(self.cache_key, history, timeout=86400)
        return True

    def wait(self):
        """Implement a backoff strategy by increasing wait time based on limits hit."""
        if self.recent_requests_day >= self.rates["day"]:
            return 86400
        if self.recent_requests_hour >= self.rates["hour"]:
            return 3600
        if self.recent_requests_minute >= self.rates["minute"]:
            return 60
        return None


class AIDocumentRateThrottle(AIBaseRateThrottle):
    """Throttle for limiting AI requests per document with backoff."""

    def __init__(self, *args, **kwargs):
        super().__init__(settings.AI_DOCUMENT_RATE_THROTTLE_RATES)

    def get_cache_key(self, request, view):
        """Include document ID in the cache key."""
        document_id = view.kwargs["pk"]
        return f"document_{document_id}_throttle_ai"


class AIUserRateThrottle(AIBaseRateThrottle):
    """Throttle that limits requests per user or IP with backoff and rate limits."""

    def __init__(self, *args, **kwargs):
        super().__init__(settings.AI_USER_RATE_THROTTLE_RATES)

    def get_cache_key(self, request, view=None):
        """Generate a cache key based on the user ID or IP for anonymous users."""
        if request.user.is_authenticated:
            return f"user_{request.user.id!s}_throttle_ai"
        return f"anonymous_{self.get_ident(request)}_throttle_ai"

    def get_ident(self, request):
        """Return the request IP address."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        return (
            x_forwarded_for.split(",")[0]
            if x_forwarded_for
            else request.META.get("REMOTE_ADDR")
        )
