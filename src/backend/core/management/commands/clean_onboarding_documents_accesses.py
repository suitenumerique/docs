"""
Module for a management command removing accesses on onboarding documents with non privileged roles.
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from core.models import PRIVILEGED_ROLES, DocumentAccess


class Command(BaseCommand):
    """Management command removing accesses on onboarding documents with non privileged roles."""

    help = __doc__

    def handle(self, *args, **options):
        """Execute management command."""

        if not settings.USER_ONBOARDING_DOCUMENTS:
            self.stdout.write("No onboarding documents set, nothing to do.")
            return

        onboarding_document_ids = set(settings.USER_ONBOARDING_DOCUMENTS)

        DocumentAccess.objects.filter(document_id__in=onboarding_document_ids).exclude(
            role__in=PRIVILEGED_ROLES
        ).delete()

        self.stdout.write("accesses deleted.")
