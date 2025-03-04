# ruff: noqa: S311, S106
"""create_demo management command"""

import logging
import math
import random
import time
from collections import defaultdict

from django import db
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from faker import Faker

from core import models

from demo import defaults

fake = Faker()

logger = logging.getLogger("impress.commands.demo.create_demo")


def random_true_with_probability(probability):
    """return True with the requested probability, False otherwise."""
    return random.random() < probability


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
        """Add a model instance to queue to that it gets created in bulk."""
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
    """
    Create a database with demo data for developers to work in a realistic environment.
    The code is engineered to create a huge number of objects fast.
    """

    queue = BulkQueue(stdout)

    with Timeit(stdout, "Creating users"):
        name_size = int(math.sqrt(defaults.NB_OBJECTS["users"]))
        first_names = [fake.first_name() for _ in range(name_size)]
        last_names = [fake.last_name() for _ in range(name_size)]
        for i in range(defaults.NB_OBJECTS["users"]):
            first_name = random.choice(first_names)
            queue.push(
                models.User(
                    admin_email=f"user{i:d}@example.com",
                    email=f"user{i:d}@example.com",
                    password="!",
                    is_superuser=False,
                    is_active=True,
                    is_staff=False,
                    short_name=first_name,
                    full_name=f"{first_name:s} {random.choice(last_names):s}",
                    language=random.choice(settings.LANGUAGES)[0],
                )
            )
        queue.flush()

    users_ids = list(models.User.objects.values_list("id", flat=True))

    with Timeit(stdout, "Creating documents"):
        for i in range(defaults.NB_OBJECTS["docs"]):
            # pylint: disable=protected-access
            key = models.Document._int2str(i)  # noqa: SLF001
            padding = models.Document.alphabet[0] * (models.Document.steplen - len(key))
            queue.push(
                models.Document(
                    depth=1,
                    path=f"{padding}{key}",
                    creator_id=random.choice(users_ids),
                    title=fake.sentence(nb_words=4),
                    link_reach=models.LinkReachChoices.AUTHENTICATED
                    if random_true_with_probability(0.5)
                    else random.choice(models.LinkReachChoices.values),
                )
            )

        queue.flush()

    with Timeit(stdout, "Creating docs accesses"):
        docs_ids = list(models.Document.objects.values_list("id", flat=True))
        for doc_id in docs_ids:
            for user_id in random.sample(
                users_ids,
                random.randint(1, defaults.NB_OBJECTS["max_users_per_document"]),
            ):
                role = random.choice(models.RoleChoices.choices)
                queue.push(
                    models.DocumentAccess(
                        document_id=doc_id, user_id=user_id, role=role[0]
                    )
                )
        queue.flush()

    with Timeit(stdout, "Creating development users"):
        for dev_user in defaults.DEV_USERS:
            queue.push(
                models.User(
                    admin_email=dev_user["email"],
                    email=dev_user["email"],
                    sub=dev_user["email"],
                    password="!",
                    is_superuser=False,
                    is_active=True,
                    is_staff=False,
                    language=dev_user["language"]
                    or random.choice(settings.LANGUAGES)[0],
                )
            )

        queue.flush()

    with Timeit(stdout, "Creating docs accesses on development users"):
        for dev_user in defaults.DEV_USERS:
            docs_ids = list(models.Document.objects.values_list("id", flat=True))
            user_id = models.User.objects.get(email=dev_user["email"]).id

            for doc_id in docs_ids:
                role = random.choice(models.RoleChoices.choices)
                queue.push(
                    models.DocumentAccess(
                        document_id=doc_id, user_id=user_id, role=role[0]
                    )
                )

        queue.flush()

    with Timeit(stdout, "Creating Template"):
        with open(
            file="demo/data/template/code.txt", mode="r", encoding="utf-8"
        ) as text_file:
            code_data = text_file.read()

        with open(
            file="demo/data/template/css.txt", mode="r", encoding="utf-8"
        ) as text_file:
            css_data = text_file.read()

        queue.push(
            models.Template(
                id="baca9e2a-59fb-42ef-b5c6-6f6b05637111",
                title="Demo Template",
                description="This is the demo template",
                code=code_data,
                css=css_data,
                is_public=True,
            )
        )
        queue.flush()


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
