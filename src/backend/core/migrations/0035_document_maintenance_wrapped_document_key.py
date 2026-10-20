from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0034_document_is_encrypted_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="document",
            name="maintenance_wrapped_document_key",
            field=models.TextField(
                blank=True,
                help_text=(
                    "The document key wrapped by the encryption vault for the maintenance key "
                    "covering the owner's organization (base64). Only that organization's "
                    "custodians can open it, offline, to recover the content in batch; it is "
                    "never a recipient."
                ),
                null=True,
                verbose_name="maintenance wrapped document key",
            ),
        ),
        migrations.CreateModel(
            name="MaintenanceImportUpload",
            fields=[
                (
                    "key",
                    models.CharField(
                        max_length=255,
                        primary_key=True,
                        serialize=False,
                        verbose_name="object key",
                    ),
                ),
                ("document_id", models.UUIDField(verbose_name="document id")),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="created on"),
                ),
            ],
            options={
                "verbose_name": "Maintenance import upload",
                "verbose_name_plural": "Maintenance import uploads",
                "db_table": "impress_maintenance_import_upload",
            },
        ),
    ]
