"""Replace encryption_public_key_fingerprint with encryption_public_key_version.

The per-access share-time key marker moves from a fingerprint (hash of the
public key) to the encryption key's monotonic `version` integer returned by
the centralized encryption service. Comparing versions (current != stored) is
cheaper and canonical for detecting when an access needs re-encryption.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0031_remove_user_encryption_public_key"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="documentaccess",
            name="encryption_public_key_fingerprint",
        ),
        migrations.AddField(
            model_name="documentaccess",
            name="encryption_public_key_version",
            field=models.PositiveIntegerField(
                blank=True,
                help_text=(
                    "Version of the user's encryption public key at the time of sharing. "
                    "Used to detect key changes — if the user's current public key version "
                    "differs from this value, the access needs re-encryption."
                ),
                null=True,
                verbose_name="encryption public key version",
            ),
        ),
    ]
