"""Helpers to build the expected encryption fields of serialized documents."""

from core import models


def direct_user_subs(document):
    """
    Sorted subs of the users with a direct access to the document, as serialized
    in `accesses_user_ids` for authenticated users.
    """
    return sorted(
        str(sub)
        for sub in models.DocumentAccess.objects.filter(
            document=document, user__isnull=False
        ).values_list("user__sub", flat=True)
    )
