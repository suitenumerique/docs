"""
Core application enums declaration
"""

import re

from django.conf import global_settings, settings
from django.db import models
from django.utils.translation import gettext_lazy as _

ATTACHMENTS_FOLDER = "attachments"
UUID_REGEX = (
    r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}"
)
FILE_EXT_REGEX = r"\.[a-zA-Z0-9]{1,10}"
MEDIA_STORAGE_URL_PATTERN = re.compile(
    f"{settings.MEDIA_URL:s}(?P<pk>{UUID_REGEX:s})/"
    f"(?P<attachment>{ATTACHMENTS_FOLDER:s}/{UUID_REGEX:s}(?:-unsafe)?{FILE_EXT_REGEX:s})$"
)
MEDIA_STORAGE_URL_EXTRACT = re.compile(
    f"{settings.MEDIA_URL:s}({UUID_REGEX}/{ATTACHMENTS_FOLDER}/{UUID_REGEX}{FILE_EXT_REGEX})"
)


# In Django's code base, `LANGUAGES` is set by default with all supported languages.
# We can use it for the choice of languages which should not be limited to the few languages
# active in the app.
# pylint: disable=no-member
ALL_LANGUAGES = {language: _(name) for language, name in global_settings.LANGUAGES}


class MoveNodePositionChoices(models.TextChoices):
    """Defines the possible positions when moving a django-treebeard node."""

    FIRST_CHILD = "first-child", _("First child")
    LAST_CHILD = "last-child", _("Last child")
    FIRST_SIBLING = "first-sibling", _("First sibling")
    LAST_SIBLING = "last-sibling", _("Last sibling")
    LEFT = "left", _("Left")
    RIGHT = "right", _("Right")
