from django.db import migrations
from django.db.models import Exists, OuterRef

# The roles from the lowest to the highest, frozen as they were for this migration
ROLES = ["reader", "commenter", "editor", "administrator", "owner"]


def delete_covered_ask_for_accesses(apps, schema_editor):
    """
    Delete the pending access requests whose user already holds, on the document, the
    role requested or a higher one: they were given it another way than by accepting
    the request, which stayed behind.
    """
    DocumentAccess = apps.get_model("core", "DocumentAccess")
    DocumentAskForAccess = apps.get_model("core", "DocumentAskForAccess")

    for index, role in enumerate(ROLES):
        DocumentAskForAccess.objects.filter(
            Exists(
                DocumentAccess.objects.filter(
                    document_id=OuterRef("document_id"),
                    user_id=OuterRef("user_id"),
                    role__in=ROLES[index:],
                )
            ),
            role=role,
        ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0035_mention"),
    ]

    operations = [
        migrations.RunPython(
            delete_covered_ask_for_accesses,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
