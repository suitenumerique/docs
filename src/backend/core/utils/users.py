"""User sharing cache utilities."""

import logging
import time

from django.core.cache import cache
from django.db import models as db
from django.db.models import Subquery

from core import models

logger = logging.getLogger(__name__)


def get_users_sharing_documents_with_cache_key(user):
    """Generate a unique cache key for each user."""
    return f"users_sharing_documents_with_{user.id}"


def users_sharing_documents_with(user):
    """
    Returns a map of users sharing documents with the given user,
    sorted by last shared date.
    """
    start_time = time.time()
    cache_key = get_users_sharing_documents_with_cache_key(user)
    cached_result = cache.get(cache_key)

    if cached_result is not None:
        elapsed = time.time() - start_time
        logger.info(
            "users_sharing_documents_with cache hit for user %s (took %.3fs)",
            user.id,
            elapsed,
        )
        return cached_result

    user_docs_qs = models.DocumentAccess.objects.filter(user=user).values_list(
        "document_id", flat=True
    )
    shared_qs = (
        models.DocumentAccess.objects.filter(document_id__in=Subquery(user_docs_qs))
        .exclude(user=user)
        .values("user")
        .annotate(last_shared=db.Max("created_at"))
    )
    result = {item["user"]: item["last_shared"] for item in shared_qs}
    cache.set(cache_key, result, 86400)  # Cache for 1 day
    elapsed = time.time() - start_time
    logger.info(
        "users_sharing_documents_with cache miss for user %s (took %.3fs)",
        user.id,
        elapsed,
    )
    return result
