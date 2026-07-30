# ruff: noqa: S311, S106
"""create_demo management command"""

import base64
import logging
import math
import random
import time
from collections import defaultdict
from uuid import uuid4

from django import db
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

import pycrdt
from faker import Faker

from core import models

from demo import defaults

languages = [x for (x, y) in settings.LANGUAGES]
fake = Faker(languages)

logger = logging.getLogger("impress.commands.demo.create_demo")


def random_true_with_probability(probability):
    """return True with the requested probability, False otherwise."""
    return random.random() < probability


def get_ydoc_for_text(text):
    """Return a ydoc from plain text for demo purposes."""
    ydoc = pycrdt.Doc()
    paragraph = pycrdt.XmlElement("p", {}, [pycrdt.XmlText(text)])
    fragment = pycrdt.XmlFragment([paragraph])
    ydoc["document-store"] = fragment
    update = ydoc.get_update()
    return base64.b64encode(update).decode("utf-8")


class BulkQueue:
    """A utility class to create Django model instances in bulk by just pushing to a queue."""

    BATCH_SIZE = 20000

    def __init__(self, stdout, *args, **kwargs):
        """Define the queue as a dict of lists."""
        self.queue = defaultdict(list)
        self.stdout = stdout

    def _bulk_create(self, objects):
        """Actually create instances in bulk in the database."""
        if not objects:
            return

        objects[0]._meta.model.objects.bulk_create(objects, ignore_conflicts=False)  # noqa: SLF001
        # In debug mode, Django keeps query cache which creates a memory leak in this case
        db.reset_queries()
        self.queue[objects[0]._meta.model.__name__] = []  # noqa: SLF001

    def push(self, obj):
        """Add a model instance to queue so that it gets created in bulk."""
        objects = self.queue[obj._meta.model.__name__]  # noqa: SLF001
        objects.append(obj)
        if len(objects) > self.BATCH_SIZE:
            self._bulk_create(objects)
            self.stdout.write(".", ending="")

    def flush(self):
        """Flush the queue after creating the remaining model instances."""
        for objects in self.queue.values():
            self._bulk_create(objects)


class Timeit:
    """A utility context manager/method decorator to time execution."""

    total_time = 0

    def __init__(self, stdout, sentence=None):
        """Set the sentence to be displayed for timing information."""
        self.sentence = sentence
        self.start = None
        self.stdout = stdout

    def __call__(self, func):
        """Behavior on call for use as a method decorator."""

        def timeit_wrapper(*args, **kwargs):
            """wrapper to trigger/stop the timer before/after function call."""
            self.__enter__()
            result = func(*args, **kwargs)
            self.__exit__(None, None, None)
            return result

        return timeit_wrapper

    def __enter__(self):
        """Start timer upon entering context manager."""
        self.start = time.perf_counter()
        if self.sentence:
            self.stdout.write(self.sentence, ending=".")

    def __exit__(self, exc_type, exc_value, exc_tb):
        """Stop timer and display result upon leaving context manager."""
        if exc_type is not None:
            raise exc_type(exc_value)
        end = time.perf_counter()
        elapsed_time = end - self.start
        if self.sentence:
            self.stdout.write(f" Took {elapsed_time:g} seconds")

        self.__class__.total_time += elapsed_time
        return elapsed_time


def create_demo(stdout):
    """Not supported with the Drive integration."""
    # The document tree, sharing and listing are owned by Drive: demo documents
    # created locally would have no Drive item and would be invisible in the
    # app. Seed data through the Drive app instead.
    raise CommandError(
        "create_demo is not supported with the Drive integration: documents "
        "must be created through Drive."
    )

class Command(BaseCommand):
    """A management command to create a demo database."""

    help = __doc__

    def add_arguments(self, parser):
        """Add argument to require forcing execution when not in debug mode."""
        parser.add_argument(
            "-f",
            "--force",
            action="store_true",
            default=False,
            help="Force command execution despite DEBUG is set to False",
        )

    def handle(self, *args, **options):
        """Handling of the management command."""
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                (
                    "This command is not meant to be used in production environment "
                    "except you know what you are doing, if so use --force parameter"
                )
            )

        create_demo(self.stdout)
