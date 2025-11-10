from django.db import migrations


def update_titles_to_null(apps, schema_editor):
    """
    If the titles are "Untitled document" or "Unbenanntes Dokument" or "Document sans titre"
    we set them to Null
    """
    Document = apps.get_model("core", "Document")
    Document.objects.filter(
        title__in=["Untitled document", "Unbenanntes Dokument", "Document sans titre"]
    ).update(title=None)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0017_add_fields_for_soft_delete"),
    ]

    operations = [
        migrations.RunPython(
            update_titles_to_null, reverse_code=migrations.RunPython.noop
        ),
    ]
