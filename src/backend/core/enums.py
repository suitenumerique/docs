"""
Core application enums declaration
"""

from django.conf import global_settings
from django.db import models
from django.utils.translation import gettext_lazy as _

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
