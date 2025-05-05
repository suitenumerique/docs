"""Impress package. Import the celery app early to load shared task form dependencies."""

from .celery_app import app as celery_app

__all__ = ["celery_app"]
