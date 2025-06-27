"""Send mail using celery task."""

from django.conf import settings

from core import models

from impress.celery_app import app


@app.task
def send_ask_for_access_mail(ask_for_access_id):
    """Send mail using celery task."""
    # Send email to document owners/admins
    ask_for_access = models.DocumentAskForAccess.objects.get(id=ask_for_access_id)
    owner_admin_accesses = models.DocumentAccess.objects.filter(
        document=ask_for_access.document, role__in=models.PRIVILEGED_ROLES
    ).select_related("user")

    for access in owner_admin_accesses:
        if access.user and access.user.email:
            ask_for_access.send_ask_for_access_email(
                access.user.email,
                access.user.language or settings.LANGUAGE_CODE,
            )
