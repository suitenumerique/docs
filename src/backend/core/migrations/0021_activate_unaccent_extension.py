from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0020_remove_is_public_add_field_attachments_and_duplicated_from"),
    ]

    operations = [UnaccentExtension()]
