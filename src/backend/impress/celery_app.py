"""Impress celery configuration file."""

import os

from celery import Celery
from configurations.importer import install

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "impress.settings")
os.environ.setdefault("DJANGO_CONFIGURATION", "Development")

install(check_options=True)

# Can not be loaded only after install call.
from django.conf import settings  # pylint: disable=wrong-import-position

app = Celery("impress")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django apps.
# autodiscover_tasks looks for "tasks.py" in each app by default
# We also need to discover tasks in subdirectories like core/tasks/
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS + ["core.tasks"], related_name="mail")
app.autodiscover_tasks(lambda: ["core.tasks"], related_name="outline_import")
