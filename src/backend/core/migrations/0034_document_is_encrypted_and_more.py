from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0033_document_document_attachments_gin"),
    ]

    operations = [
        migrations.AddField(
            model_name="document",
            name="is_encrypted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="documentaccess",
            name="encrypted_document_symmetric_key_for_user",
            field=models.TextField(
                blank=True,
                help_text="Encrypted symmetric key for this document, specific to this user.",
                null=True,
                verbose_name="encrypted document symmetric key",
            ),
        ),
        migrations.AddField(
            model_name="documentaccess",
            name="encryption_public_key_version",
            field=models.PositiveIntegerField(
                blank=True,
                help_text=(
                    "Version of the user's encryption public key at the time of sharing. "
                    "Used to detect key changes: if the user's current public key version "
                    "differs from this value, the access needs re-encryption."
                ),
                null=True,
                verbose_name="encryption public key version",
            ),
        ),
    ]
