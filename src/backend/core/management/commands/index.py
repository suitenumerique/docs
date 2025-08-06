"""
Handle search setup that needs to be done at bootstrap time.
"""

import logging
import time

from django.core.management.base import BaseCommand

from ...services.search_indexers import FindDocumentIndexer

logger = logging.getLogger("docs.search.bootstrap_search")


class Command(BaseCommand):
    """Index all documents to remote search service"""

    help = __doc__

    def handle(self, *args, **options):
        """Launch and log search index generation."""
        logger.info("Starting to regenerate Find index...")
        start = time.perf_counter()

        FindDocumentIndexer().index()

        duration = time.perf_counter() - start
        logger.info("Search index regenerated in %.2f seconds.", duration)
