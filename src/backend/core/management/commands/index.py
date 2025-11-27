"""
Handle search setup that needs to be done at bootstrap time.
"""

import logging
import time

from django.core.management.base import BaseCommand, CommandError

from core.services.search_indexers import get_document_indexer

logger = logging.getLogger("docs.search.bootstrap_search")


class Command(BaseCommand):
    """Index all documents to remote search service"""

    help = __doc__

    def add_arguments(self, parser):
        """Add argument to require forcing execution when not in debug mode."""
        parser.add_argument(
            "--batch-size",
            action="store",
            dest="batch_size",
            type=int,
            default=50,
            help="Indexation query batch size",
        )

    def handle(self, *args, **options):
        """Launch and log search index generation."""
        indexer = get_document_indexer()

        if not indexer:
            raise CommandError("The indexer is not enabled or properly configured.")

        logger.info("Starting to regenerate Find index...")
        start = time.perf_counter()
        batch_size = options["batch_size"]

        try:
            count = indexer.index(batch_size=batch_size)
        except Exception as err:
            raise CommandError("Unable to regenerate index") from err

        duration = time.perf_counter() - start
        logger.info(
            "Search index regenerated from %d document(s) in %.2f seconds.",
            count,
            duration,
        )
