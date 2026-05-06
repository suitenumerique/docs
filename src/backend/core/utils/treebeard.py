"""Treebeard path collision handling utilities."""

import logging
import time

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction

logger = logging.getLogger(__name__)


def _is_tree_path_collision(exc):
    """Return True when `exc` is caused by a Document.path uniqueness conflict.

    Treebeard computes the materialized path by reading the current siblings;
    under concurrency two callers may compute the same value. Depending on
    timing this surfaces either as:

    - `django.core.exceptions.ValidationError` raised by `full_clean()` /
      `validate_unique()` before the INSERT (BaseModel.save calls full_clean),
      with this message `{'path': ['Document with this Path already exists.']}`
    - or `IntegrityError` from the database unique index when the validate
      step misses the conflict. With this message:
          duplicate key value violates unique constraint "impress_document_path_key"
          DETAIL:  Key (path)=(0000001) already exists.

    """
    if isinstance(exc, DjangoValidationError):
        message_dict = getattr(exc, "message_dict", None)
        if message_dict is not None:
            return "path" in message_dict
        return "path" in str(exc).lower()

    # search in the IntegrityError exception
    return "impress_document_path_key" in str(exc).lower()


def create_tree_node_with_retry(create_fn):
    """Run `create_fn` in a fresh atomic block, retrying on path collisions.

    The Document.path field carries a unique constraint, which is the source of
    truth that prevents duplicate paths. On collision we let the failed
    transaction roll back, and call `create_fn` again so treebeard recomputes
    the path from the latest state.
    """
    max_attempts = settings.TREEBEARD_PATH_COMPUTE_RETRY_MAX_ATTEMPTS
    for attempt in range(max_attempts):
        try:
            with transaction.atomic():
                return create_fn()
        except (IntegrityError, DjangoValidationError) as exc:
            if not _is_tree_path_collision(exc) or attempt == max_attempts - 1:
                raise
            logger.info(
                "tree path collision on attempt %d/%d, retrying",
                attempt + 1,
                max_attempts,
            )
            time.sleep(attempt * 0.1)

    raise RuntimeError("create_tree_node_with_retry exited without result")
