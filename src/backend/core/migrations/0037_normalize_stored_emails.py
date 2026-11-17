"""Normalize stored emails to ASCII lowercase, so identity lookups can match them exactly."""

import string

from django.db import migrations

BATCH_SIZE = 500

_ASCII_LOWERCASE_TABLE = str.maketrans(
    string.ascii_uppercase,
    string.ascii_lowercase,
)


def normalize_email(email):
    """Strip an email and lowercase its ASCII letters only."""
    if not email:
        return email
    return email.strip().translate(_ASCII_LOWERCASE_TABLE)


def delete_duplicate_invitations(apps):
    """Keep the most recent invitation of each document and normalized email."""
    invitation_model = apps.get_model("core", "Invitation")
    seen = set()
    duplicate_ids = []
    for invitation_id, document_id, email in invitation_model.objects.order_by(
        "-created_at"
    ).values_list("id", "document_id", "email"):
        key = (document_id, normalize_email(email))
        if key in seen:
            duplicate_ids.append(invitation_id)
        seen.add(key)
    invitation_model.objects.filter(id__in=duplicate_ids).delete()


def forwards(apps, schema_editor):
    """ASCII-lowercase the emails stored on users and invitations."""
    delete_duplicate_invitations(apps)

    for model_name in ("User", "Invitation"):
        model = apps.get_model("core", model_name)
        to_update = []
        for obj in model.objects.only("id", "email").iterator():
            normalized = normalize_email(obj.email)
            if normalized != obj.email:
                obj.email = normalized
                to_update.append(obj)
                # Flushed as it goes, so the list stays bounded on a large table
                if len(to_update) >= BATCH_SIZE:
                    model.objects.bulk_update(to_update, ["email"])
                    to_update = []
        if to_update:
            model.objects.bulk_update(to_update, ["email"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0036_delete_covered_ask_for_accesses"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
