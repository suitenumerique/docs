# Generated manually for Outline import feature

import uuid

import django.contrib.postgres.fields
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0024_add_is_masked_field_to_link_trace"),
    ]

    operations = [
        migrations.CreateModel(
            name="OutlineImportJob",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        help_text="primary key for the record as UUID",
                        primary_key=True,
                        serialize=False,
                        verbose_name="id",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        help_text="date and time at which a record was created",
                        verbose_name="created on",
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True,
                        help_text="date and time at which a record was last updated",
                        verbose_name="updated on",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("scanning", "Scanning"),
                            ("processing", "Processing"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        help_text="current status of the import job",
                        max_length=20,
                        verbose_name="status",
                    ),
                ),
                (
                    "zip_file_key",
                    models.CharField(
                        help_text="S3 key of the uploaded zip file",
                        max_length=255,
                        verbose_name="zip file key",
                    ),
                ),
                (
                    "created_document_ids",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.UUIDField(),
                        blank=True,
                        default=list,
                        help_text="list of document IDs created during import",
                        size=None,
                        verbose_name="created document IDs",
                    ),
                ),
                (
                    "error_message",
                    models.TextField(
                        blank=True,
                        help_text="error message if import failed",
                        verbose_name="error message",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        help_text="user who initiated the import",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="outline_import_jobs",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="user",
                    ),
                ),
            ],
            options={
                "verbose_name": "Outline import job",
                "verbose_name_plural": "Outline import jobs",
                "db_table": "core_outline_import_job",
                "ordering": ["-created_at"],
            },
        ),
    ]
